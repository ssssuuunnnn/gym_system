"""
最新消息與 LINE 發送（見 docs/adr/0012-news-and-tags.md、R50–R52）。

- 消息發布後出現在形象網站（首頁「最新消息」段落、/site/news、/site/news/<id>）。
- 用 LINE 發給一群會員：對象＝有勾選標籤的會員 ∪ 會員名單條件（services/member_segments）。
  公告可能含促銷，只發給已綁定 LINE 且同意優惠訊息的會員（R31）；同一則消息不會發給同一人兩次。
- 走會員推播的 outbox（line_member_messages，event＝最新消息）：重試、每月上限、發送紀錄都沿用。
函式只 add / flush，由呼叫端 commit。
"""

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.tenant_context import current_tenant
from app.models.line import LineNotificationStatus
from app.models.line_oa import LineMemberEvent, LineMemberMessage
from app.models.member_tag import MemberTag, MemberTagLink
from app.models.news import NewsBroadcast, NewsPost
from app.models.user import User, UserRole
from app.models.website import Website
from app.schemas.news import BroadcastPreview, BroadcastTarget
from app.services import line_member
from app.services import line_oa as oa
from app.services.line import _admin_url, _gym_name
from app.services.member_segments import find_members, reach_of

NEWS_PATH = "/site/news"
SENDABLE = "可發送"


class NewsError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def path_of(post: NewsPost) -> str:
    return f"{NEWS_PATH}/{post.id}"


def dedupe_key(post_id: int, user_id: int) -> str:
    return f"news:{post_id}:{user_id}"


def published_posts(db: Session, limit: int | None = None) -> list[NewsPost]:
    query = db.query(NewsPost).filter(NewsPost.is_published.is_(True)).order_by(
        NewsPost.published_at.desc(), NewsPost.id.desc()
    )
    return query.limit(limit).all() if limit else query.all()


# ---------- 對象 ----------


def tagged_members(db: Session, tag_ids: list[int]) -> list[User]:
    """有其中任一個標籤的會員（不含管理員與黑名單）。"""
    if not tag_ids:
        return []
    return (
        db.query(User)
        .filter(
            User.id.in_(db.query(MemberTagLink.user_id).filter(MemberTagLink.tag_id.in_(tag_ids))),
            User.role == UserRole.member,
            User.is_blacklisted.is_(False),
        )
        .all()
    )


def check_tags(db: Session, tag_ids: list[int]) -> list[MemberTag]:
    tags = db.query(MemberTag).filter(MemberTag.id.in_(tag_ids)).all() if tag_ids else []
    if len(tags) != len(set(tag_ids)):
        raise NewsError("有標籤已經被刪除，請重新選擇")
    return tags


def resolve_targets(db: Session, target: BroadcastTarget) -> list[User]:
    """有勾選標籤的會員 ∪ 會員名單條件找到的會員（不含管理員與黑名單）。"""
    check_tags(db, target.tag_ids)
    users = {u.id: u for u in tagged_members(db, target.tag_ids)}
    if target.filters is not None:
        for user, _ in find_members(db, target.filters):
            users.setdefault(user.id, user)
    return list(users.values())


def describe_target(db: Session, target: BroadcastTarget) -> str:
    parts = []
    tags = check_tags(db, target.tag_ids)
    if tags:
        parts.append("標籤：" + "、".join(t.name for t in sorted(tags, key=lambda t: t.name)))
    if target.filters is not None:
        f = target.filters
        text = f"會員名單：{f.start.year}/{f.start.month}/{f.start.day}–{f.end.year}/{f.end.month}/{f.end.day} 上過課"
        if f.kind != "全部":
            text += f"（{f.kind}）"
        if f.min_attended > 1:
            text += f"・至少 {f.min_attended} 次"
        if f.max_remaining_hours is not None:
            text += f"・剩餘 ≤ {f.max_remaining_hours:g}"
        if f.inactive_days is not None:
            text += f"・{f.inactive_days} 天沒來"
        if f.tag_ids:
            text += "・限標籤：" + "、".join(t.name for t in check_tags(db, f.tag_ids))
        parts.append(text)
    return "；".join(parts)[:300]


def already_sent_ids(db: Session, post: NewsPost) -> set[int]:
    prefix = f"news:{post.id}:"
    return {
        uid
        for (uid,) in db.query(LineMemberMessage.user_id).filter(
            LineMemberMessage.event == LineMemberEvent.news, LineMemberMessage.dedupe_key.like(prefix + "%")
        )
    }


def website_published(db: Session) -> bool:
    site = db.query(Website).first()
    return bool(site and site.published)


def preview(db: Session, post: NewsPost, target: BroadcastTarget) -> BroadcastPreview:
    users = resolve_targets(db, target)
    reaches = [reach_of(u) for u in users]
    sent_before = already_sent_ids(db, post)
    to_send = [u for u, r in zip(users, reaches) if r == SENDABLE and u.id not in sent_before]
    oa_enabled = oa.get_enabled_channel(db) is not None
    site_ok = website_published(db)
    problems = []
    if not target.tag_ids and target.filters is None:
        problems.append("請選擇會員標籤或會員名單條件")
    if not oa_enabled:
        problems.append("LINE 官方帳號尚未啟用（系統設定 › LINE 官方帳號）")
    if not post.is_published:
        problems.append("這則消息還沒發布，會員點開會看不到")
    if not site_ok:
        problems.append("形象網站還沒發布，會員點開會看不到消息內容")
    if (target.tag_ids or target.filters is not None) and not to_send:
        problems.append("沒有可以發送的會員（需已綁定 LINE 且同意優惠訊息，且還沒收過這則）")
    return BroadcastPreview(
        total=len(users),
        sendable=reaches.count(SENDABLE),
        no_line=reaches.count("未綁定 LINE"),
        no_consent=reaches.count("未同意優惠訊息"),
        already_sent=sum(1 for u, r in zip(users, reaches) if r == SENDABLE and u.id in sent_before),
        to_send=len(to_send),
        oa_enabled=oa_enabled,
        website_published=site_ok,
        problems=problems,
    )


# ---------- LINE 卡片 ----------


def _absolute(path: str) -> str:
    return _admin_url(path)


def build_news_card(gym_name: str, post: NewsPost) -> dict:
    """消息卡片：（有圖時）大圖、店名、標題、摘要、「看完整內容」按鈕連到網站上的這則消息。"""
    body = [
        {"type": "text", "text": gym_name, "size": "xs", "color": "#4A4F57"},
        {"type": "text", "text": post.title, "weight": "bold", "size": "lg", "wrap": True},
    ]
    if post.summary:
        body.append({"type": "text", "text": post.summary, "size": "sm", "wrap": True, "margin": "md", "color": "#3A3F47"})
    bubble = {
        "type": "bubble",
        "body": {"type": "box", "layout": "vertical", "spacing": "sm", "contents": body},
        "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "button",
                    "style": "primary",
                    "color": "#1677FF",
                    "action": {"type": "uri", "label": "看完整內容", "uri": _absolute(path_of(post))},
                }
            ],
        },
    }
    # LINE 只接受 https 圖片
    if post.image_url and settings.PUBLIC_SCHEME == "https":
        bubble["hero"] = {
            "type": "image",
            "url": _absolute(post.image_url),
            "size": "full",
            "aspectRatio": "20:13",
            "aspectMode": "cover",
        }
    return {"type": "flex", "altText": f"【{gym_name}】{post.title}", "contents": bubble}


# ---------- 發送 ----------


def broadcast(db: Session, post: NewsPost, target: BroadcastTarget, actor_name: str) -> tuple[NewsBroadcast, list[int]]:
    """建立一次發送並把每位收件人放進會員推播 outbox（呼叫端 commit 後再 schedule）。"""
    result = preview(db, post, target)
    if result.problems:
        raise NewsError(result.problems[0])
    sent_before = already_sent_ids(db, post)
    users = [u for u in resolve_targets(db, target) if reach_of(u) == SENDABLE and u.id not in sent_before]
    message = build_news_card(_gym_name(db), post)
    record = NewsBroadcast(
        news_id=post.id,
        tag_ids=sorted(set(target.tag_ids)),
        filters=target.filters.model_dump(mode="json") if target.filters else None,
        target_label=describe_target(db, target),
        matched_count=result.total,
        queued_count=len(users),
        created_by_name=actor_name,
    )
    db.add(record)
    ids = []
    for user in users:
        row = LineMemberMessage(
            event=LineMemberEvent.news, user_id=user.id, message=message, dedupe_key=dedupe_key(post.id, user.id)
        )
        db.add(row)
        db.flush()
        ids.append(row.id)
    db.flush()
    return record, ids


def dispatch_all(tenant_id: int, message_ids: list[int]) -> None:
    """背景工作：分批送出（每批 line_member.DISPATCH_BATCH 筆）。"""
    for start in range(0, len(message_ids), line_member.DISPATCH_BATCH):
        line_member.dispatch_tenant(tenant_id, message_ids[start : start + line_member.DISPATCH_BATCH])


def schedule(background_tasks, message_ids: list[int]) -> None:
    tenant = current_tenant.get()
    if message_ids and tenant is not None:
        background_tasks.add_task(dispatch_all, tenant.id, message_ids)


def delivery_stats(db: Session, post_ids: list[int]) -> dict[int, dict[str, int]]:
    """每則消息的 LINE 發送結果（所有發送合計）。"""
    stats: dict[int, dict[str, int]] = {pid: {"sent": 0, "failed": 0, "pending": 0, "skipped": 0} for pid in post_ids}
    if not post_ids:
        return stats
    rows = (
        db.query(LineMemberMessage.dedupe_key, LineMemberMessage.status)
        .filter(LineMemberMessage.event == LineMemberEvent.news)
        .all()
    )
    bucket = {
        LineNotificationStatus.sent: "sent",
        LineNotificationStatus.failed: "failed",
        LineNotificationStatus.pending: "pending",
        LineNotificationStatus.retrying: "pending",
        LineNotificationStatus.skipped_cap: "skipped",
        LineNotificationStatus.skipped_disabled: "skipped",
    }
    for key, status in rows:
        try:
            pid = int((key or "").split(":")[1])
        except (IndexError, ValueError):
            continue
        if pid in stats:
            stats[pid][bucket[status]] += 1
    return stats


def broadcast_counts(db: Session, post_ids: list[int]) -> dict[int, tuple[int, datetime | None]]:
    if not post_ids:
        return {}
    rows = (
        db.query(NewsBroadcast.news_id, func.count(NewsBroadcast.id), func.max(NewsBroadcast.created_at))
        .filter(NewsBroadcast.news_id.in_(post_ids))
        .group_by(NewsBroadcast.news_id)
        .all()
    )
    return {pid: (count, last) for pid, count, last in rows}

"""
最新消息（見 docs/adr/0012-news-and-tags.md、R50–R52）：
- 新增、編輯、發布、刪除（後台「最新消息」，權限＝形象網站）
- 用 LINE 發給會員（有勾選標籤的會員 ∪ 會員名單條件；權限＝會員名單），只發給同意優惠訊息的人
"""

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_db, get_tenant, require_perm
from app.core.tenant_context import TenantInfo
from app.models.news import NewsBroadcast, NewsPost
from app.models.user import User
from app.schemas.news import (
    BroadcastPreview,
    BroadcastResult,
    BroadcastTarget,
    NewsBroadcastList,
    NewsBroadcastSummary,
    NewsDelivery,
    NewsIn,
    NewsOut,
)
from app.services import news as news_service

router = APIRouter(prefix="/news", tags=["news"])

require_access = require_perm("website")
require_send = require_perm("segments")


def _actor(user: User) -> str:
    return user.display_name or user.username


def _get(db: Session, news_id: int) -> NewsPost:
    post = db.get(NewsPost, news_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到這則消息")
    return post


def _check_image(payload: NewsIn, tenant: TenantInfo) -> None:
    if payload.image_url and not payload.image_url.startswith(f"/media/{tenant.subdomain}/site/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="圖片必須是在後台上傳的檔案")


def _out(db: Session, posts: list[NewsPost]) -> list[NewsOut]:
    ids = [p.id for p in posts]
    counts = news_service.broadcast_counts(db, ids)
    return [
        NewsOut.model_validate(p).model_copy(
            update={
                "path": news_service.path_of(p),
                "broadcast_count": counts.get(p.id, (0, None))[0],
                "last_broadcast_at": counts.get(p.id, (0, None))[1],
            }
        )
        for p in posts
    ]


@router.get("", response_model=list[NewsOut], dependencies=[Depends(require_perm("website", "segments"))])
def list_news(db: Session = Depends(get_db)):
    """新的在前（還沒發布的草稿依建立時間）。"""
    posts = db.query(NewsPost).order_by(NewsPost.created_at.desc(), NewsPost.id.desc()).all()
    return _out(db, posts)


def _apply(post: NewsPost, payload: NewsIn) -> None:
    post.title = payload.title
    post.summary = payload.summary
    post.body = payload.body
    post.image_url = payload.image_url
    if payload.is_published and post.published_at is None:
        post.published_at = datetime.utcnow()
    post.is_published = payload.is_published


@router.post("", response_model=NewsOut, status_code=status.HTTP_201_CREATED)
def create_news(
    payload: NewsIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_access),
    tenant: TenantInfo = Depends(get_tenant),
):
    _check_image(payload, tenant)
    post = NewsPost(created_by_name=_actor(current_user), updated_by_name=_actor(current_user))
    _apply(post, payload)
    db.add(post)
    db.commit()
    return _out(db, [post])[0]


@router.put("/{news_id}", response_model=NewsOut)
def update_news(
    news_id: int,
    payload: NewsIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_access),
    tenant: TenantInfo = Depends(get_tenant),
):
    post = _get(db, news_id)
    _check_image(payload, tenant)
    _apply(post, payload)
    post.updated_by_name = _actor(current_user)
    db.commit()
    return _out(db, [post])[0]


@router.delete("/{news_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_access)])
def delete_news(news_id: int, db: Session = Depends(get_db)):
    """刪除消息與它的發送紀錄（已經送出的 LINE 訊息收不回來，連結會變成找不到）。"""
    db.delete(_get(db, news_id))
    db.commit()


# ---------- LINE 發送 ----------


@router.post("/{news_id}/broadcast/preview", response_model=BroadcastPreview, dependencies=[Depends(require_send)])
def preview_broadcast(news_id: int, target: BroadcastTarget, db: Session = Depends(get_db)):
    """發送前試算：找到幾位、可以發幾位、哪些原因收不到。"""
    try:
        return news_service.preview(db, _get(db, news_id), target)
    except news_service.NewsError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message)


@router.post("/{news_id}/broadcast", response_model=BroadcastResult, status_code=status.HTTP_201_CREATED)
def broadcast(
    news_id: int,
    target: BroadcastTarget,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_send),
):
    """由店家的 LINE 官方帳號推播給對象中同意優惠訊息的會員（每人算一則 LINE 方案額度）。"""
    post = _get(db, news_id)
    try:
        record, ids = news_service.broadcast(db, post, target, _actor(current_user))
    except news_service.NewsError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message)
    db.commit()
    news_service.schedule(background_tasks, ids)
    return BroadcastResult(broadcast_id=record.id, queued=len(ids))


@router.get(
    "/{news_id}/broadcasts",
    response_model=NewsBroadcastList,
    dependencies=[Depends(require_perm("website", "segments"))],
)
def list_broadcasts(news_id: int, db: Session = Depends(get_db)):
    """這則消息的發送紀錄，以及所有發送合計的結果（成功／失敗／等待中／略過）。"""
    post = _get(db, news_id)
    rows = (
        db.query(NewsBroadcast).filter(NewsBroadcast.news_id == post.id).order_by(NewsBroadcast.id.desc()).all()
    )
    return NewsBroadcastList(
        delivery=NewsDelivery(**news_service.delivery_stats(db, [post.id])[post.id]),
        items=[
            NewsBroadcastSummary(
                id=r.id,
                target_label=r.target_label,
                matched_count=r.matched_count,
                queued_count=r.queued_count,
                created_by_name=r.created_by_name,
                created_at=r.created_at,
            )
            for r in rows
        ],
    )

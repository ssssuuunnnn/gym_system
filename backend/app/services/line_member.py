"""
從健身房自己的 LINE 官方帳號推播給會員（ADR 0005 第二階段）。

- 事件：預約成功／未成立（審核或櫃台代訂）、櫃台取消預約、確認收款、上課提醒（前一天）
- 只發給已綁定 LINE、沒有關閉通知的會員；健身房可逐項關閉、設定每月上限
- 會員自己的操作（自己送出、自己取消、自己下單）不發，畫面上已經看得到結果
- 和店家通知（services/line.py）一樣用 outbox：與事件同一個交易寫入，回應後送出；
  暫時錯誤在 1、5、30 分鐘後重試；送完清掉訊息內容。費用算在健身房自己的 LINE 方案
"""

import logging
from datetime import date, datetime, timedelta

from fastapi import BackgroundTasks
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.services import terms
from app.core import clock
from app.core.tenant_context import TenantInfo, current_tenant
from app.db import session as db_session
from app.models.course import Course
from app.models.line import LineNotificationStatus
from app.models.line_oa import MEMBER_EVENT_FLAG, LineMemberEvent, LineMemberMessage, LineOaChannel
from app.models.product import Product, ProductCategory
from app.models.reservation import Reservation, ReservationSource, ReservationStatus
from app.models.tenant import Tenant
from app.models.user import User
from app.services import line_oa as oa
from app.services.branches import label_for
from app.services.line import RETRY_DELAYS, LineApiError, _gym_name, build_card, month_start_utc

logger = logging.getLogger(__name__)

DISPATCH_BATCH = 50
# 上課提醒只在設定的整點起 2 小時內產生：太晚才確認的預約已經收到「預約成功」，不再半夜提醒
REMINDER_WINDOW_HOURS = 2
WEEKDAY = "一二三四五六日"


def date_label(d: date) -> str:
    return f"{d.month}/{d.day}（{WEEKDAY[d.isoweekday() - 1]}）"


def time_label(reservation: Reservation) -> str:
    return f"{date_label(reservation.booking_date)} {reservation.start_hour:02d}:00"


def item_name(db: Session, reservation: Reservation) -> str:
    if reservation.course_id:
        course = db.get(Course, reservation.course_id)
        if course:
            return course.name
    product = db.get(Product, reservation.product_id)
    return product.name if product else terms.t("service")


# ---------- enqueue ----------


def enqueue(
    db: Session,
    event: LineMemberEvent,
    user: User | None,
    title: str,
    rows: list[tuple[str, str]],
    button_label: str,
    liff_path: str,
    *,
    dedupe_key: str | None = None,
) -> int | None:
    """
    建立一筆待推播訊息（呼叫端 commit）。官方帳號未啟用、這種通知關閉、會員沒綁 LINE 或關閉通知、
    或同一件事已經發過（dedupe_key）時不建立，回傳 None。
    """
    channel = oa.get_enabled_channel(db)
    if channel is None or not getattr(channel, MEMBER_EVENT_FLAG[event]):
        return None
    if user is None or not user.line_user_id or not user.line_notify:
        return None
    if dedupe_key and db.query(LineMemberMessage.id).filter(LineMemberMessage.dedupe_key == dedupe_key).first():
        return None
    message = build_card(_gym_name(db), title, rows, button_label, "", uri=oa.liff_url(channel.liff_id, liff_path))
    row = LineMemberMessage(event=event, user_id=user.id, message=message, dedupe_key=dedupe_key)
    db.add(row)
    db.flush()
    return row.id


def schedule(background_tasks: BackgroundTasks, message_id: int | None) -> None:
    """回應送出後再推播。"""
    tenant = current_tenant.get()
    if message_id is not None and tenant is not None:
        background_tasks.add_task(dispatch_tenant, tenant.id, [message_id])


def _with_branch(db: Session, reservation: Reservation, rows: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """有兩間以上分店時，在「項目」後面加上分店（ADR 0007）。"""
    branch = label_for(db, reservation.branch_id)
    return rows[:1] + [("分店", branch)] + rows[1:] if branch else rows


def notify_booking_result(db: Session, reservation: Reservation) -> int | None:
    """審核結果，或櫃台直接幫會員建立（已確認）的預約。"""
    member = db.get(User, reservation.member_id)
    rows = [("項目", item_name(db, reservation)), ("時間", time_label(reservation)), ("人數", f"{reservation.people_count} 人")]
    rows = _with_branch(db, reservation, rows)
    if reservation.status == ReservationStatus.confirmed:
        title = "櫃台已為你預約" if reservation.source == ReservationSource.admin_created else "預約成功"
        return enqueue(db, LineMemberEvent.booking_confirmed, member, title, rows, "查看我的預約", "bookings")
    if reservation.status == ReservationStatus.rejected:
        rows = [r for r in rows if r[0] != "人數"] + [
            ("說明", f"這個時段無法安排，扣抵的{terms.t('hours')}已退回" if reservation.purchase_id else "這個時段無法安排")
        ]
        return enqueue(db, LineMemberEvent.booking_rejected, member, "預約未成立", rows, "重新預約", "book")
    return None


def notify_booking_cancelled(db: Session, reservation: Reservation, refunded: bool) -> int | None:
    """櫃台幫會員取消預約。"""
    member = db.get(User, reservation.member_id)
    rows = _with_branch(db, reservation, [("項目", item_name(db, reservation)), ("時間", time_label(reservation))])
    if reservation.purchase_id:
        rows.append((terms.t("hours"), "已退回" if refunded else "不退回（取消期限內）"))
    return enqueue(db, LineMemberEvent.booking_cancelled, member, "預約已取消", rows, "查看我的預約", "bookings")


def notify_payment_confirmed(db: Session, purchase) -> int | None:
    member = db.get(User, purchase.user_id)
    product = purchase.product
    rows = [("方案", f"{product.name} × {purchase.quantity}"), ("金額", f"NT$ {float(purchase.amount):,.0f}")]
    if product.category == ProductCategory.supply:
        return enqueue(db, LineMemberEvent.payment_confirmed, member, "已收到款項", rows, "查看我的訂單", "products")
    rows.append((terms.t("hours"), f"已入帳 {float(purchase.total_hours):g} {terms.t('unit')}"))
    # 課程方案：直接到預約頁；會員若是為了某堂課才買的，預約頁會自動打開那堂（前端 lib/bookIntent.ts）
    return enqueue(db, LineMemberEvent.payment_confirmed, member, "已收到款項", rows, f"去{terms.t('book')}", "book")


# ---------- 上課提醒 ----------


def enqueue_reminders(db: Session, channel: LineOaChannel) -> list[int]:
    """
    在提醒時段內（設定整點起 2 小時，健身房當地時間），替明天有已確認預約的會員各建立一則提醒
    （同一天多堂合成一則；dedupe_key 確保一天只發一次）。
    """
    if not channel.is_enabled or not channel.notify_class_reminder:
        return []
    now = clock.now_local()
    if not (channel.reminder_hour <= now.hour < channel.reminder_hour + REMINDER_WINDOW_HOURS):
        return []
    tomorrow = now.date() + timedelta(days=1)
    reservations = (
        db.query(Reservation)
        .join(User, User.id == Reservation.member_id)
        .filter(
            Reservation.booking_date == tomorrow,
            Reservation.status == ReservationStatus.confirmed,
            User.line_user_id.isnot(None),
            User.line_notify.is_(True),
        )
        .order_by(Reservation.member_id, Reservation.start_hour)
        .all()
    )
    by_member: dict[int, list[Reservation]] = {}
    for r in reservations:
        by_member.setdefault(r.member_id, []).append(r)
    ids = []
    for member_id, items in by_member.items():
        rows = [("日期", f"明天 {date_label(tomorrow)}")] + [
            (f"{r.start_hour:02d}:00", item_name(db, r) + (f"・{b}" if (b := label_for(db, r.branch_id)) else ""))
            for r in items
        ]
        message_id = enqueue(
            db,
            LineMemberEvent.class_reminder,
            db.get(User, member_id),
            f"明天的{terms.t('service')}提醒",
            rows,
            "查看我的預約",
            "bookings",
            dedupe_key=f"reminder:{member_id}:{tomorrow.isoformat()}",
        )
        if message_id is not None:
            ids.append(message_id)
    return ids


# ---------- dispatch ----------


def sent_this_month(db: Session) -> int:
    return (
        db.query(func.count(LineMemberMessage.id))
        .filter(LineMemberMessage.status == LineNotificationStatus.sent, LineMemberMessage.created_at >= month_start_utc())
        .scalar()
        or 0
    )


def _finish(m: LineMemberMessage, status: LineNotificationStatus, note: str | None) -> None:
    m.status = status
    m.note = note
    m.message = None
    m.updated_at = datetime.utcnow()


def _process(db: Session, m: LineMemberMessage, channel: LineOaChannel | None) -> None:
    if channel is None or not channel.is_enabled:
        _finish(m, LineNotificationStatus.skipped_disabled, "LINE 官方帳號未啟用")
        return
    user = db.get(User, m.user_id)
    if user is None or not user.line_user_id or not user.line_notify:
        _finish(m, LineNotificationStatus.skipped_disabled, "會員已解除 LINE 綁定或關閉通知")
        return
    cap = channel.member_monthly_cap
    if cap is not None and sent_this_month(db) + 1 > cap:
        _finish(m, LineNotificationStatus.skipped_cap, f"本月已達上限 {cap} 則，未發送")
        return
    client = oa.client_for(channel)
    if client is None:
        _finish(m, LineNotificationStatus.failed, "金鑰無法解密，請重新設定 LINE 官方帳號")
        return
    try:
        client.push(user.line_user_id, [m.message])
    except LineApiError as exc:
        m.attempts += 1
        m.updated_at = datetime.utcnow()
        # LINE 方案額度用完也是 429，但重試沒有用
        quota_exceeded = exc.status == 429 and "monthly limit" in exc.message.lower()
        if quota_exceeded:
            _finish(m, LineNotificationStatus.failed, "已達 LINE 官方帳號本月訊息額度")
        elif exc.retryable and m.attempts <= len(RETRY_DELAYS):
            delay = RETRY_DELAYS[m.attempts - 1]
            m.status = LineNotificationStatus.retrying
            m.next_attempt_at = datetime.utcnow() + delay
            m.note = f"LINE 暫時無回應，{int(delay.total_seconds() // 60)} 分鐘後重試（第 {m.attempts} 次）"
        else:
            _finish(m, LineNotificationStatus.failed,
                    f"LINE 回應 {exc.status}：{exc.message[:120]}" if exc.status else exc.message[:150])
        logger.warning("會員 LINE 通知 %s 發送失敗：%s", m.id, exc.message)
        return
    _finish(m, LineNotificationStatus.sent, None)


def _tenant_context(db: Session, tenant_id: int):
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        return None, None
    token = current_tenant.set(TenantInfo(id=tenant.id, subdomain=tenant.subdomain, timezone=tenant.timezone, business_type=tenant.business_type.name))
    return tenant, token


def dispatch_tenant(tenant_id: int, message_ids: list[int] | None = None, *, with_reminders: bool = False) -> int:
    """
    處理某家健身房到期的會員訊息（或指定的幾筆）；with_reminders 時先產生上課提醒。
    FOR UPDATE SKIP LOCKED 認領，多個程序同時跑也不會重複發送。回傳處理筆數。
    """
    db = db_session.tenant_session(tenant_id)
    token = None
    try:
        tenant, token = _tenant_context(db, tenant_id)
        if tenant is None:
            return 0
        channel = oa.get_channel(db)
        if with_reminders and channel is not None:
            enqueue_reminders(db, channel)
            db.flush()
        query = db.query(LineMemberMessage).filter(
            LineMemberMessage.status.in_((LineNotificationStatus.pending, LineNotificationStatus.retrying))
        )
        if message_ids is not None:
            query = query.filter(LineMemberMessage.id.in_(message_ids))
        else:
            query = query.filter(LineMemberMessage.next_attempt_at <= datetime.utcnow())
        rows = query.order_by(LineMemberMessage.id).with_for_update(skip_locked=True).limit(DISPATCH_BATCH).all()
        for m in rows:
            _process(db, m, channel)
        db.commit()
        return len(rows)
    except Exception:
        db.rollback()
        logger.exception("會員 LINE 通知發送程序發生錯誤（健身房 %s）", tenant_id)
        return 0
    finally:
        if token is not None:
            current_tenant.reset(token)
        db.close()


def run_due() -> int:
    """背景工作：逐家產生上課提醒並發送到期的訊息。"""
    with db_session.SessionLocal() as s:
        tenant_ids = [tid for (tid,) in s.query(Tenant.id).order_by(Tenant.id)]
    return sum(dispatch_tenant(tid, with_reminders=True) for tid in tenant_ids)

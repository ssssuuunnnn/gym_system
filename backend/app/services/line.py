"""
LINE 通知店家（見 docs/adr/0004-line-notifications.md）。

平台共用一個 LINE 官方帳號（Messaging API）。流程：
1. 事件發生時（體驗課詢問、會員下單、預約申請）在同一個交易裡 enqueue 一筆 line_notifications（outbox）
2. 回應送出後由背景工作 dispatch：檢查每月上限 → 呼叫 LINE multicast → 記錄結果
3. 暫時性錯誤（逾時、429、5xx）在 1、5、30 分鐘後重試；成功或放棄後清掉訊息內容

通知只寫最少資訊：體驗課詢問只有姓氏，不含手機號碼；會員下單與預約不寫會員身分。
"""

import base64
import hashlib
import hmac
import logging
import secrets
import threading
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Protocol

import httpx
from fastapi import BackgroundTasks
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core import clock
from app.core.config import settings
from app.core.tenant_context import TenantInfo, current_tenant
from app.db import session as db_session
from app.models.line import LineEvent, LineNotification, LineNotificationStatus, LineRecipient
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

BIND_CODE_TTL = timedelta(minutes=10)
# 暫時性錯誤的重試間隔：第 1、2、3 次重試
RETRY_DELAYS = (timedelta(minutes=1), timedelta(minutes=5), timedelta(minutes=30))
MULTICAST_LIMIT = 500
DISPATCH_BATCH = 50

# 每種事件對應的接收人開關欄位
EVENT_FLAG = {
    LineEvent.inquiry: "notify_inquiry",
    LineEvent.payment: "notify_payment",
    LineEvent.booking: "notify_booking",
}


# ---------- LINE API ----------


class LineApiError(Exception):
    def __init__(self, status: int | None, message: str):
        super().__init__(message)
        self.status = status
        self.message = message

    @property
    def retryable(self) -> bool:
        # 網路錯誤（沒有狀態碼）、太頻繁、LINE 伺服器錯誤：稍後重試
        return self.status is None or self.status == 429 or self.status >= 500


class LineClient(Protocol):
    def multicast(self, to: list[str], messages: list[dict]) -> None: ...
    def reply(self, reply_token: str, messages: list[dict]) -> None: ...
    def get_profile(self, user_id: str) -> dict: ...


class HttpLineClient:
    def __init__(self, token: str, base_url: str):
        self._client = httpx.Client(
            base_url=base_url, headers={"Authorization": f"Bearer {token}"}, timeout=httpx.Timeout(10.0)
        )

    def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        try:
            response = self._client.request(method, path, **kwargs)
        except httpx.HTTPError as exc:
            raise LineApiError(None, f"無法連線 LINE：{type(exc).__name__}") from exc
        if response.status_code >= 400:
            try:
                message = response.json().get("message", "")
            except ValueError:
                message = response.text[:200]
            raise LineApiError(response.status_code, message)
        return response

    def multicast(self, to: list[str], messages: list[dict]) -> None:
        self._request("POST", "/v2/bot/message/multicast", json={"to": to, "messages": messages})

    def reply(self, reply_token: str, messages: list[dict]) -> None:
        self._request("POST", "/v2/bot/message/reply", json={"replyToken": reply_token, "messages": messages})

    def get_profile(self, user_id: str) -> dict:
        return self._request("GET", f"/v2/bot/profile/{user_id}").json()


_client: LineClient | None = None
_client_lock = threading.Lock()


def get_client() -> LineClient | None:
    """沒有設定 channel access token 時回 None（不發送）。測試以 monkeypatch 換成假的 client。"""
    global _client
    if not settings.LINE_CHANNEL_ACCESS_TOKEN:
        return None
    with _client_lock:
        if _client is None:
            _client = HttpLineClient(settings.LINE_CHANNEL_ACCESS_TOKEN, settings.LINE_API_BASE)
    return _client


def is_configured() -> bool:
    return bool(settings.LINE_CHANNEL_ACCESS_TOKEN and settings.LINE_CHANNEL_SECRET)


def verify_signature(body: bytes, signature: str | None) -> bool:
    if not settings.LINE_CHANNEL_SECRET or not signature:
        return False
    digest = hmac.new(settings.LINE_CHANNEL_SECRET.encode(), body, hashlib.sha256).digest()
    return hmac.compare_digest(base64.b64encode(digest).decode(), signature)


def add_friend_url() -> str | None:
    basic_id = settings.LINE_BOT_BASIC_ID.strip()
    if not basic_id:
        return None
    return f"https://line.me/R/ti/p/{basic_id if basic_id.startswith('@') else '@' + basic_id}"


def text_message(text: str) -> dict:
    return {"type": "text", "text": text}


# ---------- 綁定碼 ----------


def new_bind_code() -> str:
    return f"{secrets.randbelow(10**6):06d}"


def hash_bind_code(code: str) -> str:
    return hashlib.sha256(f"{settings.SECRET_KEY}:line-bind:{code}".encode()).hexdigest()


def normalize_bind_code(text: str) -> str | None:
    """「482 913」「482-913」都當成 482913；不是 6 位數字就回 None。"""
    digits = "".join(ch for ch in text if not ch.isspace() and ch != "-")
    return digits if len(digits) == 6 and digits.isdigit() else None


# ---------- 訊息內容 ----------


def masked_name(name: str) -> str:
    """王小明 → 王先生／小姐（只留姓氏）。"""
    name = name.strip()
    return f"{name[0]}先生／小姐" if name else "（未填姓名）"


def _admin_url(path: str) -> str:
    tenant = current_tenant.get()
    host = f"{tenant.subdomain}.{settings.BASE_DOMAIN}" if tenant else settings.BASE_DOMAIN
    return f"{settings.PUBLIC_SCHEME}://{host}{path}"


def build_card(
    gym_name: str, title: str, rows: list[tuple[str, str]], button_label: str, path: str, *, uri: str | None = None
) -> dict:
    """Flex 訊息卡片：健身房名稱、標題、幾行資訊、一顆按鈕（預設進後台的 path；給 uri 時直接用，例如會員的 LIFF 頁面）。"""
    return {
        "type": "flex",
        "altText": f"【{gym_name}】{title}",
        "contents": {
            "type": "bubble",
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "contents": [
                    {"type": "text", "text": gym_name, "size": "xs", "color": "#4A4F57"},
                    {"type": "text", "text": title, "weight": "bold", "size": "lg", "wrap": True},
                    {
                        "type": "box",
                        "layout": "vertical",
                        "spacing": "xs",
                        "margin": "md",
                        "contents": [
                            {
                                "type": "box",
                                "layout": "baseline",
                                "contents": [
                                    {"type": "text", "text": label, "size": "sm", "color": "#4A4F57", "flex": 2},
                                    {"type": "text", "text": value or "—", "size": "sm", "wrap": True, "flex": 5},
                                ],
                            }
                            for label, value in rows
                        ],
                    },
                ],
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "button",
                        "style": "primary",
                        "color": "#1677FF",
                        "action": {"type": "uri", "label": button_label, "uri": uri or _admin_url(path)},
                    }
                ],
            },
        },
    }


def _gym_name(db: Session) -> str:
    from app.models.system_settings import SystemSettings

    row = db.query(SystemSettings).first()
    if row:
        return row.short_name or row.company_name
    tenant = current_tenant.get()
    return tenant.subdomain if tenant else "健身房"


# ---------- enqueue ----------


def enqueue(
    db: Session,
    event: LineEvent,
    title: str,
    rows: list[tuple[str, str]],
    button_label: str,
    path: str,
    *,
    recipient_id: int | None = None,
) -> int | None:
    """
    建立一筆待發送通知（呼叫端負責 commit）。沒有人訂閱這種通知時不建立，回傳 None。
    recipient_id：只發給這一位（測試通知用）。
    """
    query = db.query(LineRecipient).filter(LineRecipient.is_active.is_(True))
    if recipient_id is not None:
        query = query.filter(LineRecipient.id == recipient_id)
    elif event in EVENT_FLAG:
        query = query.filter(getattr(LineRecipient, EVENT_FLAG[event]).is_(True))
    user_ids = [r.line_user_id for r in query.order_by(LineRecipient.id)]
    if not user_ids:
        return None
    notification = LineNotification(
        event=event,
        recipient_ids=user_ids,
        recipient_count=len(user_ids),
        message=build_card(_gym_name(db), title, rows, button_label, path),
    )
    db.add(notification)
    db.flush()
    return notification.id


def schedule(background_tasks: BackgroundTasks, notification_id: int | None) -> None:
    """回應送出後再發送，不讓 LINE 的速度或錯誤影響使用者的操作。"""
    tenant = current_tenant.get()
    if notification_id is not None and tenant is not None:
        background_tasks.add_task(dispatch_tenant, tenant.id, [notification_id])


def notify_inquiry(db: Session, inquiry) -> int | None:
    return enqueue(
        db,
        LineEvent.inquiry,
        "新的體驗課詢問",
        [("姓名", masked_name(inquiry.name)), ("想體驗", inquiry.interest or ""), ("方便時段", inquiry.preferred_slot or "")],
        "查看並聯絡",
        "/admin/inquiries",
    )


def notify_payment(db: Session, purchase, product) -> int | None:
    amount = float(purchase.amount)
    return enqueue(
        db,
        LineEvent.payment,
        "會員下單，等待確認收款",
        [("方案", f"{product.name} × {purchase.quantity}"), ("金額", f"NT$ {amount:,.0f}")],
        "到購買紀錄確認收款",
        "/admin/purchases",
    )


def notify_booking(db: Session, reservation, item_name: str) -> int | None:
    return enqueue(
        db,
        LineEvent.booking,
        "新的預約，等待審核",
        [
            ("項目", item_name),
            ("時間", f"{reservation.booking_date.month}/{reservation.booking_date.day} {reservation.start_hour:02d}:00"),
            ("人數", f"{reservation.people_count} 人"),
        ],
        "到預約審核",
        "/admin/reservations",
    )


def notify_test(db: Session, recipient_id: int) -> int | None:
    return enqueue(
        db,
        LineEvent.test,
        "測試通知",
        [("說明", "收到這則訊息，代表 LINE 通知設定正確。")],
        "開啟後台",
        "/admin/settings",
        recipient_id=recipient_id,
    )


# ---------- dispatch ----------


def month_start_utc(timezone_name: str | None = None) -> datetime:
    """本月 1 日 00:00（健身房當地時間）換成伺服器使用的 UTC 時間（不帶時區）。"""
    tenant = current_tenant.get()
    tz = ZoneInfo(timezone_name or (tenant.timezone if tenant else settings.STUDIO_TIMEZONE))
    local_start = clock.now_local().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return local_start.replace(tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)


def sent_this_month(db: Session) -> int:
    start = month_start_utc()
    total = (
        db.query(func.coalesce(func.sum(LineNotification.sent_count), 0))
        .filter(LineNotification.status == LineNotificationStatus.sent, LineNotification.created_at >= start)
        .scalar()
    )
    return int(total or 0)


def _finish(n: LineNotification, status: LineNotificationStatus, note: str | None, sent: int = 0) -> None:
    n.status = status
    n.note = note
    n.sent_count = sent
    n.recipient_ids = None
    n.message = None
    n.updated_at = datetime.utcnow()


def _process(db: Session, n: LineNotification, cap: int) -> None:
    client = get_client()
    if client is None:
        _finish(n, LineNotificationStatus.skipped_disabled, "平台尚未設定 LINE 官方帳號")
        return
    if sent_this_month(db) + n.recipient_count > cap:
        _finish(n, LineNotificationStatus.skipped_cap, f"本月已達上限 {cap} 則，未發送")
        return
    ids = list(n.recipient_ids or [])
    try:
        for i in range(0, len(ids), MULTICAST_LIMIT):
            client.multicast(ids[i : i + MULTICAST_LIMIT], [n.message])
    except LineApiError as exc:
        n.attempts += 1
        n.updated_at = datetime.utcnow()
        if exc.retryable and n.attempts <= len(RETRY_DELAYS):
            delay = RETRY_DELAYS[n.attempts - 1]
            n.status = LineNotificationStatus.retrying
            n.next_attempt_at = datetime.utcnow() + delay
            n.note = f"LINE 暫時無回應，{int(delay.total_seconds() // 60)} 分鐘後重試（第 {n.attempts} 次）"
        else:
            detail = f"LINE 回應 {exc.status}：{exc.message[:120]}" if exc.status else exc.message[:150]
            _finish(n, LineNotificationStatus.failed, detail)
        logger.warning("LINE 通知 %s 發送失敗：%s", n.id, exc.message)
        return
    _finish(n, LineNotificationStatus.sent, None, sent=n.recipient_count)


def dispatch_tenant(tenant_id: int, notification_ids: list[int] | None = None) -> int:
    """
    發送某家健身房到期的通知（或指定的幾筆）。用 FOR UPDATE SKIP LOCKED 認領，
    多個程序同時跑也不會重複發送。回傳處理筆數。
    """
    db = db_session.tenant_session(tenant_id)
    token = None
    try:
        tenant = db.get(Tenant, tenant_id)
        if tenant is None:
            return 0
        cap = tenant.line_monthly_cap
        # 背景執行緒沒有請求的租戶資訊：設定好，讓「本月」依該家時區計算
        token = current_tenant.set(TenantInfo(id=tenant.id, subdomain=tenant.subdomain, timezone=tenant.timezone))
        query = db.query(LineNotification).filter(
            LineNotification.status.in_((LineNotificationStatus.pending, LineNotificationStatus.retrying))
        )
        if notification_ids is not None:
            query = query.filter(LineNotification.id.in_(notification_ids))
        else:
            query = query.filter(LineNotification.next_attempt_at <= datetime.utcnow())
        rows = query.order_by(LineNotification.id).with_for_update(skip_locked=True).limit(DISPATCH_BATCH).all()
        for n in rows:
            _process(db, n, cap)
        db.commit()
        return len(rows)
    except Exception:
        db.rollback()
        logger.exception("LINE 通知發送程序發生錯誤（健身房 %s）", tenant_id)
        return 0
    finally:
        if token is not None:
            current_tenant.reset(token)
        db.close()


def dispatch_all_due() -> int:
    """背景重試：逐家處理到期的通知。"""
    with db_session.SessionLocal() as s:
        tenant_ids = [tid for (tid,) in s.query(Tenant.id).order_by(Tenant.id)]
    return sum(dispatch_tenant(tid) for tid in tenant_ids)


def start_dispatch_loop() -> threading.Event | None:
    """啟動背景重試執行緒；回傳停止用的 Event。間隔設 0 時不啟動。"""
    interval = settings.LINE_DISPATCH_INTERVAL_SECONDS
    if interval <= 0:
        return None
    stop = threading.Event()

    def loop():
        while not stop.wait(interval):
            try:
                dispatch_all_due()
            except Exception:  # 不讓背景執行緒因為一次錯誤就停止
                logger.exception("LINE 通知背景重試失敗")
            try:
                # 健身房官方帳號推播給會員：上課提醒與重試（ADR 0005 第二階段）
                from app.services import line_member

                line_member.run_due()
            except Exception:
                logger.exception("會員 LINE 通知背景工作失敗")

    threading.Thread(target=loop, name="line-dispatch", daemon=True).start()
    return stop

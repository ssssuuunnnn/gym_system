"""
健身房自己的 LINE 官方帳號（見 docs/adr/0005-gym-line-oa.md）：
- 管理員：讀取／儲存設定、檢查連線（成功才啟用）、停用、重新建立底部選單
- 公開：LIFF 入口讀取 LIFF ID 與健身房名稱
- Webhook：只接受用這家 channel secret 簽章的請求；加好友回歡迎訊息，關鍵字回對應頁面的按鈕
"""

import json
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core import crypto
from app.core.tenant_context import TenantInfo
from app.deps import get_db, get_tenant, require_admin
from app.models.line_oa import LineOaChannel
from app.models.tenant import Tenant
from app.models.user import User
from app.models.line_oa import LineMemberMessage
from app.schemas.line_oa import (
    LineMemberMessageOut,
    LineOaNotifyUpdate,
    LineOaOut,
    LineOaPublic,
    LineOaQuota,
    LineOaUpdate,
    LineOaVerifyOut,
)
from app.services import line_member
from app.services import line_oa as oa
from app.services.line import LineApiError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/line-oa", tags=["line-oa"])


def _gym_name(db: Session, tenant: TenantInfo) -> str:
    row = db.get(Tenant, tenant.id)
    return row.name if row else tenant.subdomain


def _to_out(db: Session, tenant: TenantInfo, channel: LineOaChannel | None) -> LineOaOut:
    base = {
        "webhook_url": oa.webhook_url(tenant),
        "liff_endpoint_url": oa.liff_endpoint_url(tenant),
        "linked_members": db.query(func.count(User.id)).filter(User.line_user_id.isnot(None)).scalar() or 0,
    }
    if channel is None:
        return LineOaOut(configured=False, enabled=False, **base)
    return LineOaOut(
        configured=True,
        enabled=channel.is_enabled,
        login_channel_id=channel.login_channel_id,
        liff_id=channel.liff_id,
        channel_secret_hint=crypto.hint(crypto.decrypt(channel.channel_secret_enc)),
        access_token_hint=crypto.hint(crypto.decrypt(channel.access_token_enc)),
        bot_basic_id=channel.bot_basic_id,
        bot_name=channel.bot_name,
        bot_picture_url=channel.bot_picture_url,
        rich_menu_set=channel.rich_menu_id is not None,
        verified_at=channel.verified_at,
        last_error=channel.last_error,
        updated_by_name=channel.updated_by_name,
        updated_at=channel.updated_at,
        notify_booking_result=channel.notify_booking_result,
        notify_booking_cancel=channel.notify_booking_cancel,
        notify_payment_confirmed=channel.notify_payment_confirmed,
        notify_class_reminder=channel.notify_class_reminder,
        reminder_hour=channel.reminder_hour,
        member_monthly_cap=channel.member_monthly_cap,
        member_sent_this_month=line_member.sent_this_month(db),
        liff_url=oa.liff_url(channel.liff_id) if channel.is_enabled else None,
        add_friend_url=oa.add_friend_url(channel.bot_basic_id) if channel.is_enabled else None,
        **base,
    )


def _require_channel(db: Session) -> LineOaChannel:
    channel = oa.get_channel(db)
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="尚未設定 LINE 官方帳號")
    return channel


@router.get("", response_model=LineOaOut, dependencies=[Depends(require_admin)])
def get_settings(tenant: TenantInfo = Depends(get_tenant), db: Session = Depends(get_db)):
    return _to_out(db, tenant, oa.get_channel(db))


@router.put("", response_model=LineOaOut)
def save_settings(
    payload: LineOaUpdate,
    tenant: TenantInfo = Depends(get_tenant),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """儲存後一律停用，要再按「檢查連線」才會啟用。"""
    login_channel_id = payload.login_channel_id.strip()
    liff_id = payload.liff_id.strip()
    problem = oa.liff_id_problem(liff_id, login_channel_id)
    if problem:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=problem)
    secret = (payload.channel_secret or "").strip()
    token = (payload.access_token or "").strip()

    channel = oa.get_channel(db)
    if channel is None:
        if not secret or not token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="請填寫 Channel secret 與 Channel access token")
        channel = LineOaChannel(channel_secret_enc="", access_token_enc="", login_channel_id="", liff_id="")
        db.add(channel)
    if secret:
        channel.channel_secret_enc = crypto.encrypt(secret)
    if token:
        channel.access_token_enc = crypto.encrypt(token)
    channel.login_channel_id = login_channel_id
    channel.liff_id = liff_id
    channel.is_enabled = False
    channel.last_error = None
    channel.updated_by_name = current_user.username
    db.commit()
    db.refresh(channel)
    return _to_out(db, tenant, channel)


@router.post("/verify", response_model=LineOaVerifyOut, dependencies=[Depends(require_admin)])
def verify(tenant: TenantInfo = Depends(get_tenant), db: Session = Depends(get_db)):
    """檢查連線：官方帳號、LIFF、Webhook、底部選單。必要項目都通過才啟用。"""
    channel = _require_channel(db)
    checks = oa.run_checks(db, channel, tenant, _gym_name(db, tenant))
    db.commit()
    db.refresh(channel)
    return LineOaVerifyOut(enabled=channel.is_enabled, checks=checks, settings=_to_out(db, tenant, channel))


@router.post("/disable", response_model=LineOaOut, dependencies=[Depends(require_admin)])
def disable(tenant: TenantInfo = Depends(get_tenant), db: Session = Depends(get_db)):
    """停用：會員無法在 LINE 裡登入，Webhook 不再回覆；已綁定的會員保留，重新啟用後照常使用。"""
    channel = _require_channel(db)
    channel.is_enabled = False
    db.commit()
    db.refresh(channel)
    return _to_out(db, tenant, channel)


@router.patch("/notifications", response_model=LineOaOut, dependencies=[Depends(require_admin)])
def update_notifications(
    payload: LineOaNotifyUpdate, tenant: TenantInfo = Depends(get_tenant), db: Session = Depends(get_db)
):
    """會員通知：逐項開關、上課提醒時間、每月上限。立即生效，不需重新檢查連線。"""
    channel = _require_channel(db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "reminder_hour" and value is None:
            continue
        setattr(channel, field, value)
    db.commit()
    db.refresh(channel)
    return _to_out(db, tenant, channel)


@router.get("/quota", response_model=LineOaQuota, dependencies=[Depends(require_admin)])
def quota(db: Session = Depends(get_db)):
    """向 LINE 查詢官方帳號本月的訊息額度與已用量（含其他工具發的訊息）。"""
    channel = _require_channel(db)
    client = oa.client_for(channel)
    if client is None:
        return LineOaQuota(error="金鑰無法解密，請重新設定")
    try:
        q = client.get_quota()
        used = client.get_quota_consumption().get("totalUsage")
    except LineApiError as exc:
        return LineOaQuota(error=f"無法向 LINE 查詢額度：{exc.message}")
    limited = q.get("type") == "limited"
    return LineOaQuota(limited=limited, limit=q.get("value") if limited else None, used=used)


@router.get("/messages", response_model=list[LineMemberMessageOut], dependencies=[Depends(require_admin)])
def list_messages(limit: int = 30, db: Session = Depends(get_db)):
    """最近的會員通知紀錄（不含訊息內容）。"""
    rows = (
        db.query(LineMemberMessage, User)
        .join(User, User.id == LineMemberMessage.user_id)
        .order_by(LineMemberMessage.id.desc())
        .limit(max(1, min(limit, 200)))
        .all()
    )
    return [
        LineMemberMessageOut(
            id=m.id,
            event=m.event.value,
            member_name=u.display_name or u.username,
            status=m.status.value,
            note=m.note,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
        for m, u in rows
    ]


@router.get("/public", response_model=LineOaPublic)
def public_info(tenant: TenantInfo = Depends(get_tenant), db: Session = Depends(get_db)):
    channel = oa.get_enabled_channel(db)
    return LineOaPublic(
        enabled=channel is not None,
        liff_id=channel.liff_id if channel else None,
        gym_name=_gym_name(db, tenant),
        bot_name=channel.bot_name if channel else None,
        add_friend_url=oa.add_friend_url(channel.bot_basic_id) if channel else None,
    )


@router.post("/webhook")
async def webhook(
    request: Request,
    tenant: TenantInfo = Depends(get_tenant),
    db: Session = Depends(get_db),
    x_line_signature: str | None = Header(default=None),
):
    body = await request.body()
    channel = oa.get_channel(db)
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="尚未設定 LINE 官方帳號")
    if not oa.verify_signature(channel, body, x_line_signature):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="簽章不正確")
    if not channel.is_enabled:
        return Response(status_code=status.HTTP_200_OK)  # 檢查連線時 LINE 會送測試請求，簽章正確就回 200

    try:
        events = json.loads(body).get("events", [])
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="格式不正確")
    client = oa.client_for(channel)
    gym_name = _gym_name(db, tenant)
    for event in events:
        reply_token = event.get("replyToken")
        if not reply_token or client is None:
            continue
        message = None
        if event.get("type") == "follow":
            message = oa.welcome_message(channel.liff_id, gym_name)
        elif event.get("type") == "message" and event.get("message", {}).get("type") == "text":
            message = oa.keyword_reply(channel.liff_id, event["message"].get("text", ""))
        if message is None:
            continue
        try:
            client.reply(reply_token, [message])
        except LineApiError as exc:
            logger.warning("LINE 回覆失敗（tenant=%s）：%s", tenant.id, exc.message)
    return Response(status_code=status.HTTP_200_OK)

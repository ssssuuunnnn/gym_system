"""
LINE webhook（見 docs/adr/0004-line-notifications.md）：只在平台網址提供，
LINE Developers 後台設定為 https://platform.<BASE_DOMAIN>/api/v1/line/webhook。

- follow（加好友）：回覆歡迎訊息
- message（文字）：6 位數字當綁定碼 → 綁定到產生該碼的健身房；其他文字回覆使用說明
- unfollow（封鎖）：停用此人在所有健身房的綁定

回覆訊息（reply）不計入 LINE 的訊息用量。以平台帳號連線：綁定碼的比對與跨健身房停用
透過 SECURITY DEFINER 函式，寫入接收人時切換到該健身房（受 RLS 限制）。
"""

import json
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import act_as_tenant
from app.deps import get_platform_db, require_platform_host
from app.models.line import LineBindAttempt, LineRecipient
from app.models.tenant import Tenant
from app.services import line as line_service
from app.services.line import LineApiError, text_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/line", tags=["line-webhook"], dependencies=[Depends(require_platform_host)])

# 同一個 LINE 使用者 10 分鐘內最多猜錯 5 次
ATTEMPT_WINDOW = timedelta(minutes=10)
MAX_FAILED_ATTEMPTS = 5


def _welcome() -> str:
    return (
        f"歡迎使用「{settings.LINE_BOT_NAME}」！這是健身房管理系統的通知帳號。\n"
        "請傳送健身房後台「系統設定 › LINE 通知」顯示的 6 位數綁定碼，即可開始接收通知。"
    )


def _reply(reply_token: str | None, message: str) -> None:
    client = line_service.get_client()
    if client is None or not reply_token:
        return
    try:
        client.reply(reply_token, [text_message(message)])
    except LineApiError as exc:
        logger.warning("LINE 回覆失敗：%s", exc.message)


def _display_name(user_id: str) -> str:
    client = line_service.get_client()
    if client is None:
        return "LINE 使用者"
    try:
        return (client.get_profile(user_id).get("displayName") or "LINE 使用者")[:100]
    except LineApiError:
        return "LINE 使用者"


def _handle_bind(db: Session, user_id: str, code: str) -> str:
    since = datetime.utcnow() - ATTEMPT_WINDOW
    failures = (
        db.query(LineBindAttempt)
        .filter(
            LineBindAttempt.line_user_id == user_id,
            LineBindAttempt.success.is_(False),
            LineBindAttempt.created_at >= since,
        )
        .count()
    )
    if failures >= MAX_FAILED_ATTEMPTS:
        return "嘗試次數太多，請 10 分鐘後再試。"

    row = db.execute(
        text("SELECT tenant_id, created_by_name FROM line_consume_bind_code(:h, :u)"),
        {"h": line_service.hash_bind_code(code), "u": user_id},
    ).first()
    db.add(LineBindAttempt(line_user_id=user_id, success=row is not None, tenant_id=row[0] if row else None))
    if row is None:
        db.commit()
        return "綁定碼不正確或已過期。請到健身房後台重新產生綁定碼後再傳送。"

    tenant_id, created_by = row
    gym_name = db.query(Tenant.name).filter(Tenant.id == tenant_id).scalar() or "健身房"
    act_as_tenant(db, tenant_id)
    recipient = (
        db.query(LineRecipient)
        .filter(LineRecipient.tenant_id == tenant_id, LineRecipient.line_user_id == user_id)
        .first()
    )
    name = _display_name(user_id)
    if recipient is None:
        db.add(LineRecipient(line_user_id=user_id, display_name=name, bound_by_name=created_by))
    else:
        recipient.is_active = True
        recipient.deactivated_at = None
        recipient.display_name = name
        recipient.bound_by_name = created_by
    db.commit()
    return (
        f"綁定成功。之後「{gym_name}」有新的體驗課詢問、待收款訂單或待審核預約時，會在這裡通知你。"
        "要調整或停止，請到後台「系統設定 › LINE 通知」。"
    )


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_platform_db)):
    body = await request.body()
    if not line_service.verify_signature(body, request.headers.get("x-line-signature")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="簽章不正確")
    try:
        events = json.loads(body).get("events", [])
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="格式不正確") from exc

    for event in events:
        user_id = (event.get("source") or {}).get("userId")
        if not user_id or (event.get("source") or {}).get("type") != "user":
            continue  # 只處理一對一對話
        kind = event.get("type")
        reply_token = event.get("replyToken")
        if kind == "follow":
            _reply(reply_token, _welcome())
        elif kind == "unfollow":
            db.execute(text("SELECT line_deactivate_user(:u)"), {"u": user_id})
            db.commit()
        elif kind == "message" and (event.get("message") or {}).get("type") == "text":
            code = line_service.normalize_bind_code(event["message"].get("text", ""))
            if code is None:
                _reply(reply_token, _welcome())
            else:
                _reply(reply_token, _handle_bind(db, user_id, code))
    # LINE 只要求回 200；處理結果不回傳
    return {"ok": True}

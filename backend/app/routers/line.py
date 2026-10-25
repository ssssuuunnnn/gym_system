"""
健身房後台「系統設定 › LINE 通知」API（見 docs/adr/0004-line-notifications.md）：
產生綁定碼、查詢綁定狀態、調整每位接收人要收的通知、移除、傳送測試通知。
LINE 打進來的 webhook 在 routers/line_webhook.py（平台網址）。
"""

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.tenant_context import current_tenant
from app.deps import get_db, require_admin
from app.models.line import LineBindCode, LineRecipient
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.line import (
    LineBindCodeOut,
    LineBindStatusOut,
    LineRecipientOut,
    LineRecipientUpdate,
    LineSettingsOut,
    LineTestOut,
)
from app.services import line as line_service

router = APIRouter(prefix="/line", tags=["line"])


def _recipient(db: Session, recipient_id: int) -> LineRecipient:
    recipient = db.get(LineRecipient, recipient_id)
    if recipient is None or not recipient.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到這位接收人")
    return recipient


@router.get("/settings", response_model=LineSettingsOut)
def get_settings(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    cap = db.query(Tenant.line_monthly_cap).filter(Tenant.id == current_tenant.get().id).scalar()
    recipients = (
        db.query(LineRecipient).filter(LineRecipient.is_active.is_(True)).order_by(LineRecipient.created_at).all()
    )
    return LineSettingsOut(
        configured=line_service.is_configured(),
        bot_name=settings.LINE_BOT_NAME,
        add_friend_url=line_service.add_friend_url(),
        month_sent=line_service.sent_this_month(db),
        monthly_cap=cap or 0,
        recipients=recipients,
    )


@router.post("/bind-codes", response_model=LineBindCodeOut, status_code=status.HTTP_201_CREATED)
def create_bind_code(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """產生 6 位數綁定碼（10 分鐘內有效、只能用一次）；明碼只在這次回傳，資料庫只存雜湊。"""
    # 避免這家同時有兩組相同的有效綁定碼
    while True:
        code = line_service.new_bind_code()
        code_hash = line_service.hash_bind_code(code)
        exists = (
            db.query(LineBindCode.id)
            .filter(
                LineBindCode.code_hash == code_hash,
                LineBindCode.used_at.is_(None),
                LineBindCode.expires_at > datetime.utcnow(),
            )
            .first()
        )
        if not exists:
            break
    row = LineBindCode(
        code_hash=code_hash,
        expires_at=datetime.utcnow() + line_service.BIND_CODE_TTL,
        created_by_name=admin.username,
    )
    db.add(row)
    db.commit()
    return LineBindCodeOut(id=row.id, code=code, expires_at=row.expires_at, add_friend_url=line_service.add_friend_url())


@router.get("/bind-codes/{code_id}", response_model=LineBindStatusOut)
def bind_status(code_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    """綁定對話框每隔幾秒查詢一次。"""
    row = db.get(LineBindCode, code_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到這組綁定碼")
    if row.used_at is not None:
        recipient = (
            db.query(LineRecipient)
            .filter(LineRecipient.line_user_id == row.used_by_line_user_id, LineRecipient.is_active.is_(True))
            .first()
        )
        return LineBindStatusOut(status="bound", recipient=recipient)
    if row.expires_at <= datetime.utcnow():
        return LineBindStatusOut(status="expired")
    return LineBindStatusOut(status="waiting")


@router.patch("/recipients/{recipient_id}", response_model=LineRecipientOut)
def update_recipient(
    recipient_id: int, payload: LineRecipientUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)
):
    recipient = _recipient(db, recipient_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(recipient, field, value)
    db.commit()
    db.refresh(recipient)
    return recipient


@router.delete("/recipients/{recipient_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_recipient(recipient_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    """停止通知此人（保留紀錄）。對方之後可以用新的綁定碼重新綁定。"""
    recipient = _recipient(db, recipient_id)
    recipient.is_active = False
    recipient.deactivated_at = datetime.utcnow()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/recipients/{recipient_id}/test", response_model=LineTestOut, status_code=status.HTTP_202_ACCEPTED)
def send_test(
    recipient_id: int,
    background_tasks: BackgroundTasks,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _recipient(db, recipient_id)
    notification_id = line_service.notify_test(db, recipient_id)
    db.commit()
    line_service.schedule(background_tasks, notification_id)
    return LineTestOut(queued=notification_id is not None)

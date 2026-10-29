"""
後台鈴鐺通知（ADR 0009）：只看得到自己的通知，而且只顯示目前還有權限的種類。
前端每 20 秒呼叫 /summary 拿未讀數與新通知（跳 toast），點鈴鐺時用列表分頁載入。
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.deps import get_db, require_admin
from app.models.staff_notification import StaffNotification
from app.models.user import User
from app.schemas.staff_notification import StaffNotificationOut, StaffNotificationPage, StaffNotificationSummary
from app.services import staff_notifications as notes

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _mine(db: Session, user: User):
    return db.query(StaffNotification).filter(
        StaffNotification.user_id == user.id, StaffNotification.kind.in_(notes.allowed_kinds(user))
    )


@router.get("/summary", response_model=StaffNotificationSummary)
def summary(
    after_id: int | None = Query(default=None, ge=0),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    mine = _mine(db, current_user)
    unread = mine.filter(StaffNotification.read_at.is_(None)).count()
    latest = mine.order_by(StaffNotification.id.desc()).first()
    new = []
    if after_id is not None:
        new = mine.filter(StaffNotification.id > after_id).order_by(StaffNotification.id.desc()).limit(10).all()
    return StaffNotificationSummary(unread_count=unread, latest_id=latest.id if latest else 0, new=new)


@router.get("", response_model=StaffNotificationPage)
def list_notifications(
    unread_only: bool = False,
    before_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    notes.purge_expired(db)
    db.commit()
    query = _mine(db, current_user)
    if unread_only:
        query = query.filter(StaffNotification.read_at.is_(None))
    if before_id is not None:
        query = query.filter(StaffNotification.id < before_id)
    rows = query.order_by(StaffNotification.id.desc()).limit(limit + 1).all()
    return StaffNotificationPage(items=rows[:limit], has_more=len(rows) > limit)


@router.post("/{notification_id}/read", response_model=StaffNotificationOut)
def mark_read(notification_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    note = _mine(db, current_user).filter(StaffNotification.id == notification_id).first()
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到通知")
    if note.read_at is None:
        note.read_at = datetime.utcnow()
        db.commit()
        db.refresh(note)
    return note


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    _mine(db, current_user).filter(StaffNotification.read_at.is_(None)).update(
        {StaffNotification.read_at: datetime.utcnow()}, synchronize_session=False
    )
    db.commit()

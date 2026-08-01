from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user, require_admin
from app.models.time_slot import TimeSlot
from app.models.user import User
from app.schemas.time_slot import TimeSlotOut, TimeSlotUpdate

router = APIRouter(prefix="/time-slots", tags=["time-slots"])


@router.get("", response_model=list[TimeSlotOut])
def list_time_slots(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    唯一資料來源：時段開放設定、預約審核列表／詳情、送出預約申請（含管理員建立預約）皆讀此表。
    任何已登入角色皆可讀取。
    """
    return db.query(TimeSlot).all()


@router.put("", response_model=TimeSlotOut, dependencies=[Depends(require_admin)])
def upsert_time_slot(payload: TimeSlotUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """對應「時段開放設定」：逐格點擊切換開放／關閉。僅管理員可操作。"""
    slot = (
        db.query(TimeSlot)
        .filter(TimeSlot.day_of_week == payload.day_of_week, TimeSlot.start_hour == payload.start_hour)
        .first()
    )
    if slot is None:
        slot = TimeSlot(day_of_week=payload.day_of_week, start_hour=payload.start_hour)
        db.add(slot)

    slot.is_open = payload.is_open
    slot.updated_by = admin.id
    slot.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(slot)
    return slot

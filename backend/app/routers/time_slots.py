from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.deps import get_db
from app.deps import get_current_user, require_perm
from app.models.time_slot import TimeSlot
from app.models.user import User
from app.schemas.time_slot import TimeSlotOut, TimeSlotUpdate
from app.services import branches as branch_service

router = APIRouter(prefix="/time-slots", tags=["time-slots"])

# 後台功能權限（ADR 0008）：這個檔案的管理用 API 都屬於「availability」功能
require_access = require_perm("availability")


@router.get("", response_model=list[TimeSlotOut])
def list_time_slots(
    branch_id: int | None = Query(default=None, description="只看某間分店；省略＝全部分店"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    唯一資料來源：時段開放設定、預約審核列表／詳情、送出預約申請（含管理員建立預約）皆讀此表。
    公休各分店獨立（R34）。任何已登入角色皆可讀取。
    """
    query = db.query(TimeSlot)
    if branch_id is not None:
        query = query.filter(TimeSlot.branch_id == branch_id)
    return query.all()


@router.put("", response_model=TimeSlotOut, dependencies=[Depends(require_access)])
def upsert_time_slot(payload: TimeSlotUpdate, admin: User = Depends(require_access), db: Session = Depends(get_db)):
    """對應「時段開放設定」：逐格點擊切換某間分店的開放／關閉。僅管理員可操作。"""
    branch = branch_service.active_branch(db, payload.branch_id)
    slot = (
        db.query(TimeSlot)
        .filter(
            TimeSlot.branch_id == branch.id,
            TimeSlot.slot_date == payload.slot_date,
            TimeSlot.start_hour == payload.start_hour,
        )
        .first()
    )
    if slot is None:
        slot = TimeSlot(branch=branch, slot_date=payload.slot_date, start_hour=payload.start_hour)
        db.add(slot)

    slot.is_open = payload.is_open
    slot.updated_by = admin.id
    slot.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(slot)
    return slot

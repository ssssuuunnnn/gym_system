"""開店設定清單（ADR 0016）：儀表板上的「開店設定」卡片。需要系統設定權限（主要管理者、管理者預設都有）。"""

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.tenant_context import TenantInfo
from app.deps import clear_tenant_cache, get_db, get_tenant, require_perm
from app.models.system_settings import SystemSettings
from app.models.user import User
from app.services import onboarding

router = APIRouter(prefix="/onboarding", tags=["onboarding"])
require_access = require_perm("settings")


class StepOut(BaseModel):
    key: str
    done: bool
    optional: bool


class BonusOut(BaseModel):
    """完成送試用天數（R66）。status：available＝完成就送、granted＝已送；不是試用中的店家整個是 null。"""

    days: int
    status: str
    granted_at: datetime | None
    trial_ends_at: datetime | None
    # 這次讀取時剛送出（前端顯示恭喜訊息、重新讀取試用天數）
    just_granted: bool


class ChecklistOut(BaseModel):
    steps: list[StepOut]
    done_count: int
    required_count: int
    completed: bool
    dismissed: bool
    bonus: BonusOut | None


def _out(db: Session, tenant_id: int, *, claim: bool = False) -> ChecklistOut:
    c = onboarding.checklist(db)
    b = onboarding.claim_bonus(db, tenant_id) if claim and c.completed else onboarding.bonus(db, tenant_id)
    if b.just_granted:
        db.commit()
        clear_tenant_cache()  # 試用到期日跟著租戶快取，馬上生效
    return ChecklistOut(
        steps=[StepOut(key=s.key, done=s.done, optional=s.optional) for s in c.steps],
        done_count=c.done_count,
        required_count=c.required_count,
        completed=c.completed,
        dismissed=c.dismissed,
        bonus=BonusOut(
            days=onboarding.SETUP_BONUS_DAYS,
            status=b.status,
            granted_at=b.granted_at,
            trial_ends_at=b.trial_ends_at,
            just_granted=b.just_granted,
        )
        if b.status
        else None,
    )


def _settings(db: Session) -> SystemSettings:
    from app.routers.system_settings import _get_or_create_settings

    return _get_or_create_settings(db)


@router.get("", response_model=ChecklistOut)
def get_checklist(
    db: Session = Depends(get_db), tenant: TenantInfo = Depends(get_tenant), _: User = Depends(require_access)
):
    """讀清單；必做全部完成且符合資格時，順便送試用天數（R66，每家一次）。"""
    return _out(db, tenant.id, claim=True)


@router.post("/dismiss", response_model=ChecklistOut)
def dismiss(
    db: Session = Depends(get_db), tenant: TenantInfo = Depends(get_tenant), user: User = Depends(require_access)
):
    """隱藏清單（整間店都不再顯示，可在系統設定重新打開）。"""
    row = _settings(db)
    row.onboarding_dismissed_at = datetime.utcnow()
    row.onboarding_dismissed_by = user.display_name or user.username
    db.commit()
    return _out(db, tenant.id)


@router.post("/restore", response_model=ChecklistOut)
def restore(
    db: Session = Depends(get_db), tenant: TenantInfo = Depends(get_tenant), _: User = Depends(require_access)
):
    row = _settings(db)
    row.onboarding_dismissed_at = None
    row.onboarding_dismissed_by = None
    db.commit()
    return _out(db, tenant.id)

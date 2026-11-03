"""開店設定清單（ADR 0016）：儀表板上的「開店設定」卡片。需要系統設定權限（主要管理者、管理者預設都有）。"""

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.deps import get_db, require_perm
from app.models.system_settings import SystemSettings
from app.models.user import User
from app.services import onboarding

router = APIRouter(prefix="/onboarding", tags=["onboarding"])
require_access = require_perm("settings")


class StepOut(BaseModel):
    key: str
    done: bool
    optional: bool


class ChecklistOut(BaseModel):
    steps: list[StepOut]
    done_count: int
    required_count: int
    completed: bool
    dismissed: bool


def _out(db: Session) -> ChecklistOut:
    c = onboarding.checklist(db)
    return ChecklistOut(
        steps=[StepOut(key=s.key, done=s.done, optional=s.optional) for s in c.steps],
        done_count=c.done_count,
        required_count=c.required_count,
        completed=c.completed,
        dismissed=c.dismissed,
    )


def _settings(db: Session) -> SystemSettings:
    from app.routers.system_settings import _get_or_create_settings

    return _get_or_create_settings(db)


@router.get("", response_model=ChecklistOut)
def get_checklist(db: Session = Depends(get_db), _: User = Depends(require_access)):
    return _out(db)


@router.post("/dismiss", response_model=ChecklistOut)
def dismiss(db: Session = Depends(get_db), user: User = Depends(require_access)):
    """隱藏清單（整間店都不再顯示，可在系統設定重新打開）。"""
    row = _settings(db)
    row.onboarding_dismissed_at = datetime.utcnow()
    row.onboarding_dismissed_by = user.display_name or user.username
    db.commit()
    return _out(db)


@router.post("/restore", response_model=ChecklistOut)
def restore(db: Session = Depends(get_db), _: User = Depends(require_access)):
    row = _settings(db)
    row.onboarding_dismissed_at = None
    row.onboarding_dismissed_by = None
    db.commit()
    return _out(db)

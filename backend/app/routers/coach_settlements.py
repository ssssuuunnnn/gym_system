import calendar
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import require_admin
from app.models.coach import Coach
from app.models.coach_settlement import CoachSettlementPeriod, CoachSettlementRates
from app.models.course import Course, CourseSession
from app.schemas.coach_settlement import (
    CoachSettlementRow,
    CoachSettlementSummary,
    SettlementLockRequest,
    SettlementRatesOut,
    SettlementRatesUpdate,
    SettlementSessionDetail,
    SettlementStatus,
)

router = APIRouter(prefix="/coach-settlements", tags=["coach-settlements"])


def _get_or_create_rates(db: Session) -> CoachSettlementRates:
    """全站僅一筆鐘點費設定；不存在時以預設值（皆為 0）建立（idempotent，供 GET/PUT 共用）。"""
    rates = db.query(CoachSettlementRates).first()
    if rates is None:
        rates = CoachSettlementRates()
        db.add(rates)
        db.commit()
        db.refresh(rates)
    return rates


def _compute_settlement(db: Session, year: int, month: int, is_locked: bool) -> CoachSettlementSummary:
    """依目前鐘點費設定，即時計算某月份的教練結算清單（僅團體課程有實際堂數；
    一對一、場租尚無資料來源，固定為 0）。不篩選 is_archived —— 課程封存於課堂結束後才發生，
    不應回頭影響教練當月已授課的應付費用。"""
    period_start = date(year, month, 1)
    period_end = date(year, month, calendar.monthrange(year, month)[1])
    rates = _get_or_create_rates(db)

    session_rows = (
        db.query(
            Course.coach_id,
            Coach.name.label("coach_name"),
            Course.name.label("course_name"),
            CourseSession.session_date,
            CourseSession.start_minute,
            CourseSession.duration_minutes,
        )
        .join(Course, CourseSession.course_id == Course.id)
        .join(Coach, Course.coach_id == Coach.id)
        .filter(
            CourseSession.is_cancelled.is_(False),
            CourseSession.session_date.between(period_start, period_end),
        )
        .order_by(CourseSession.session_date, CourseSession.start_minute)
        .all()
    )

    by_coach: dict[int, dict] = {}
    for row in session_rows:
        bucket = by_coach.setdefault(row.coach_id, {"coach_name": row.coach_name, "sessions": []})
        bucket["sessions"].append(
            SettlementSessionDetail(
                session_type="團體課程",
                course_name=row.course_name,
                session_date=row.session_date,
                start_minute=row.start_minute,
                duration_minutes=row.duration_minutes,
                rate=rates.group_course_rate,
                subtotal=rates.group_course_rate,
            )
        )

    status_value = SettlementStatus.locked if is_locked else SettlementStatus.pending
    rows = [
        CoachSettlementRow(
            coach_id=coach_id,
            coach_name=bucket["coach_name"],
            group_course_count=len(bucket["sessions"]),
            payable_amount=rates.group_course_rate * len(bucket["sessions"]),
            status=status_value,
            sessions=bucket["sessions"],
        )
        for coach_id, bucket in by_coach.items()
    ]
    rows.sort(key=lambda r: r.coach_name)

    return CoachSettlementSummary(
        year=year,
        month=month,
        period_start=period_start,
        period_end=period_end,
        coach_count=len(rows),
        total_payable=sum((r.payable_amount for r in rows), Decimal("0")),
        is_locked=is_locked,
        locked_at=None,
        rows=rows,
    )


@router.get("/rates", response_model=SettlementRatesOut, dependencies=[Depends(require_admin)])
def get_settlement_rates(db: Session = Depends(get_db)):
    """對應「教練費用結算」依課程類型鐘點費設定；僅管理員可讀取／修改（薪資相關資料）。"""
    return _get_or_create_rates(db)


@router.put("/rates", response_model=SettlementRatesOut, dependencies=[Depends(require_admin)])
def update_settlement_rates(payload: SettlementRatesUpdate, db: Session = Depends(get_db)):
    rates = _get_or_create_rates(db)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(rates, field, value)
    db.commit()
    db.refresh(rates)
    return rates


@router.get("", response_model=CoachSettlementSummary, dependencies=[Depends(require_admin)])
def get_settlement(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
):
    """對應「教練費用結算」清單：月份已鎖定則回傳鎖定當下的 snapshot，否則以目前鐘點費即時計算。"""
    period = (
        db.query(CoachSettlementPeriod)
        .filter(CoachSettlementPeriod.year == year, CoachSettlementPeriod.month == month)
        .first()
    )
    if period is not None and period.is_locked:
        return CoachSettlementSummary.model_validate(period.snapshot_json)
    return _compute_settlement(db, year, month, is_locked=False)


@router.post("/lock", response_model=CoachSettlementSummary, dependencies=[Depends(require_admin)])
def lock_settlement(payload: SettlementLockRequest, db: Session = Depends(get_db)):
    summary = _compute_settlement(db, payload.year, payload.month, is_locked=True)
    now = datetime.utcnow()
    summary.locked_at = now

    period = (
        db.query(CoachSettlementPeriod)
        .filter(CoachSettlementPeriod.year == payload.year, CoachSettlementPeriod.month == payload.month)
        .first()
    )
    if period is None:
        period = CoachSettlementPeriod(year=payload.year, month=payload.month)
        db.add(period)
    period.is_locked = True
    period.locked_at = now
    period.snapshot_json = summary.model_dump(mode="json")
    db.commit()
    return summary


@router.post("/unlock", response_model=CoachSettlementSummary, dependencies=[Depends(require_admin)])
def unlock_settlement(payload: SettlementLockRequest, db: Session = Depends(get_db)):
    period = (
        db.query(CoachSettlementPeriod)
        .filter(CoachSettlementPeriod.year == payload.year, CoachSettlementPeriod.month == payload.month)
        .first()
    )
    if period is None or not period.is_locked:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="尚無此月份的結算紀錄")
    period.is_locked = False
    db.commit()
    return _compute_settlement(db, payload.year, payload.month, is_locked=False)

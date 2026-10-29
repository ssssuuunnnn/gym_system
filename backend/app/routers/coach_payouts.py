from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core import clock
from app.deps import get_db
from app.deps import get_coach_profile, get_current_user, require_perm, require_coach
from app.models.coach import Coach
from app.models.coach_payout import CoachPayout, CoachPayoutItem, PayoutStatus
from app.models.user import User, UserRole
from app.schemas.coach_payout import (
    CoachPayoutCreate,
    CoachPayoutDetailOut,
    CoachPayoutOut,
    CoachPayoutSummaryRow,
    PayoutItemOut,
    PayoutMarkPaid,
    parse_month,
)
from app.services.staff import has_perm
from app.services import payouts

router = APIRouter(prefix="/coach-payouts", tags=["coach-payouts"])

# 後台功能權限（ADR 0008）：這個檔案的管理用 API 都屬於「payouts」功能
require_access = require_perm("payouts")


def _month_param(month: str = Query(..., description="YYYY-MM")):
    try:
        return parse_month(month)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc


def _get_payout(db: Session, payout_id: int) -> CoachPayout:
    payout = db.get(CoachPayout, payout_id)
    if payout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到結算紀錄")
    return payout


@router.get("/summary", response_model=list[CoachPayoutSummaryRow], dependencies=[Depends(require_access)])
def payout_summary(period=Depends(_month_param), db: Session = Depends(get_db)):
    """
    教練鐘點總表：私人教練／團體課程教練該月的即時堂數／金額，以及已存在的結算紀錄。
    場租教練不列（除非該月已有結算紀錄，例如類型後來才改）。
    """
    rows = []
    for coach in db.query(Coach).order_by(Coach.id).all():
        payout = (
            db.query(CoachPayout).filter(CoachPayout.coach_id == coach.id, CoachPayout.period == period).first()
        )
        if payout is None and not payouts.is_payable_coach(coach):
            continue
        units = payouts.billable_units(db, coach, period)
        changed = False
        if payout is not None:
            settled_keys = sorted(
                (i.kind, i.course_id, i.session_date, i.start_hour, i.attended_count, i.no_show_count,
                 payouts.money(i.fee))
                for i in payout.items
            )
            changed = settled_keys != sorted(u.key for u in units)
        rows.append(
            CoachPayoutSummaryRow(
                coach_id=coach.id,
                coach_name=coach.name,
                coach_types=coach.coach_types,
                session_rate=float(coach.session_rate),
                live_session_count=len(units),
                live_amount=float(payouts.total_amount(units)),
                payout=CoachPayoutOut.model_validate(payout) if payout else None,
                changed_since_settled=changed,
                has_zero_fee=any(u.fee == 0 for u in units),
            )
        )
    return rows


@router.get("/live", response_model=list[PayoutItemOut], dependencies=[Depends(require_access)])
def live_items(coach_id: int, period=Depends(_month_param), db: Session = Depends(get_db)):
    """尚未結算時的即時明細（結算前檢查用）。"""
    coach = db.get(Coach, coach_id)
    if coach is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到教練")
    return [
        PayoutItemOut(
            kind=u.kind,
            course_id=u.course_id,
            title=u.title,
            session_date=u.session_date,
            start_hour=u.start_hour,
            fee=float(u.fee),
            attended_count=u.attended_count,
            no_show_count=u.no_show_count,
            members="、".join(u.members),
        )
        for u in payouts.billable_units(db, coach, period)
    ]


@router.post("", response_model=CoachPayoutDetailOut, status_code=status.HTTP_201_CREATED)
def settle(payload: CoachPayoutCreate, admin: User = Depends(require_access), db: Session = Depends(get_db)):
    """結算教練某月鐘點：存下堂數、費率、金額與明細快照。只能結算已結束的月份，同月同教練只能有一筆。"""
    coach = db.get(Coach, payload.coach_id)
    if coach is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到教練")
    period = parse_month(payload.month)
    _, last = payouts.month_range(period)
    if clock.now_local().date() <= last:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="只能結算已結束的月份")
    exists = db.query(CoachPayout).filter(CoachPayout.coach_id == coach.id, CoachPayout.period == period).first()
    if exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="此教練該月已結算")

    units = payouts.billable_units(db, coach, period)
    if not units:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="本月沒有可結算的堂數")

    payout = CoachPayout(
        coach_id=coach.id,
        period=period,
        session_count=len(units),
        rate=coach.session_rate,
        amount=payouts.total_amount(units),
        status=PayoutStatus.settled,
        settled_by=admin.id,
        items=[
            CoachPayoutItem(
                kind=u.kind,
                course_id=u.course_id,
                title=u.title[:100],
                session_date=u.session_date,
                start_hour=u.start_hour,
                fee=u.fee,
                attended_count=u.attended_count,
                no_show_count=u.no_show_count,
                members="、".join(u.members)[:500],
            )
            for u in units
        ],
    )
    db.add(payout)
    db.commit()
    db.refresh(payout)
    return payout


@router.get("/mine", response_model=list[CoachPayoutOut])
def my_payouts(coach: Coach = Depends(require_coach), db: Session = Depends(get_db)):
    """教練查看自己的結算紀錄（新到舊）。"""
    return (
        db.query(CoachPayout)
        .filter(CoachPayout.coach_id == coach.id)
        .order_by(CoachPayout.period.desc())
        .all()
    )


@router.get("/{payout_id}", response_model=CoachPayoutDetailOut)
def payout_detail(payout_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """結算明細：管理員可看全部，教練只能看自己的。"""
    payout = _get_payout(db, payout_id)
    if not has_perm(current_user, "payouts"):
        coach = get_coach_profile(current_user, db)
        if coach is None or coach.id != payout.coach_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到結算紀錄")
    return payout


@router.post("/{payout_id}/mark-paid", response_model=CoachPayoutOut)
def mark_paid(
    payout_id: int,
    payload: PayoutMarkPaid,
    admin: User = Depends(require_access),
    db: Session = Depends(get_db),
):
    """標記已撥款；撥款後不可再取消結算。"""
    payout = _get_payout(db, payout_id)
    if payout.status != PayoutStatus.settled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此結算已撥款")
    payout.status = PayoutStatus.paid
    payout.paid_at = datetime.utcnow()
    payout.paid_by = admin.id
    payout.payment_note = payload.payment_note
    db.commit()
    db.refresh(payout)
    return payout


@router.delete("/{payout_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_access)])
def void_payout(payout_id: int, db: Session = Depends(get_db)):
    """取消結算（例如出席紀錄更正後要重算）；已撥款的不可取消。"""
    payout = _get_payout(db, payout_id)
    if payout.status == PayoutStatus.paid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="已撥款的結算不可取消")
    db.delete(payout)
    db.commit()

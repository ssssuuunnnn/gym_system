from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user, require_admin
from app.models.coach import Coach
from app.schemas.coach import CoachCreate, CoachOut, CoachUpdate

router = APIRouter(prefix="/coaches", tags=["coaches"])


@router.get("", response_model=list[CoachOut], dependencies=[Depends(get_current_user)])
def list_coaches(db: Session = Depends(get_db)):
    """
    對應「教練資料列表」（管理員）；其他登入會員可讀取用於預約畫面顯示教練姓名
    （如「我的預約列表」「送出預約申請」），僅新增／編輯／刪除限管理員。
    """
    return db.query(Coach).all()


@router.post("", response_model=CoachOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_coach(payload: CoachCreate, db: Session = Depends(get_db)):
    """對應「建立／編輯教練資料」：綁定會員帳號、名稱、電話。一帳號僅能綁定一筆教練資料。"""
    existing = db.query(Coach).filter(Coach.user_id == payload.user_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此帳號已綁定教練資料")

    coach = Coach(**payload.model_dump())
    db.add(coach)
    db.commit()
    db.refresh(coach)
    return coach


@router.put("/{coach_id}", response_model=CoachOut, dependencies=[Depends(require_admin)])
def update_coach(coach_id: int, payload: CoachUpdate, db: Session = Depends(get_db)):
    coach = db.get(Coach, coach_id)
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到教練資料")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(coach, field, value)
    db.commit()
    db.refresh(coach)
    return coach


@router.delete("/{coach_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_coach(coach_id: int, db: Session = Depends(get_db)):
    coach = db.get(Coach, coach_id)
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到教練資料")
    db.delete(coach)
    db.commit()

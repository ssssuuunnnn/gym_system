from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.deps import get_coach_profile, get_current_user
from app.models.user import User, UserRole
from app.schemas.user import Token, UserOut, UserRegister

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    """對應「會員註冊頁」：場租教練、學員皆使用同一頁註冊，一律建立 role=member。"""
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="帳號已被註冊")

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=UserRole.member,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut(**user.__dict__, is_coach=False)


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """對應「登入頁」：管理員與教練共用登入入口。回傳角色與是否為教練身份，供前端導向首頁。"""
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="帳號或密碼錯誤")
    if user.is_blacklisted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="帳號已被列入黑名單")

    coach = get_coach_profile(user, db)
    is_coach = coach is not None

    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token(user_id=user.id, role=user.role.value, is_coach=is_coach)
    return Token(access_token=token, role=user.role, is_coach=is_coach)


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    coach = get_coach_profile(current_user, db)
    return UserOut(**current_user.__dict__, is_coach=coach is not None)

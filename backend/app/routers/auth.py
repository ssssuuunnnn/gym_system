from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.services.members import issue_token
from app.deps import get_db
from app.deps import get_coach_profile, get_current_user
from app.models.user import User, UserRole
from app.schemas.user import ChangePassword, Token, UserOut, UserRegister, user_out

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
    return user_out(user, False)


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """對應「登入頁」：管理員與教練共用登入入口。回傳角色與是否為教練身份，供前端導向首頁。"""
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="帳號或密碼錯誤")
    token = issue_token(user, db)
    db.commit()
    return token


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """對應「會員修改密碼頁」：驗證目前密碼後設定新密碼，並解除「須自行修改密碼」狀態。"""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="目前密碼不正確")
    current_user.password_hash = hash_password(payload.new_password)
    current_user.must_change_password = False
    db.commit()


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    coach = get_coach_profile(current_user, db)
    return user_out(current_user, coach is not None)

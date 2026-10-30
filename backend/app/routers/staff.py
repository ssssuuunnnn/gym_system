"""
後台帳號（ADR 0008、R37–R39）：只有主要管理者可以新增後台帳號、設定功能權限、升降級、停用、重設密碼、移交主要管理者。
會員帳號由「會員管理」（routers/users.py）處理，這裡只處理 role=admin 的帳號。
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.deps import get_db, require_admin, require_owner
from app.models.staff_audit import StaffAuditLog
from app.models.user import StaffLevel, User, UserRole
from app.schemas.staff import (
    OwnerTransfer,
    StaffAuditOut,
    StaffCreate,
    StaffMeta,
    StaffOut,
    StaffPassword,
    StaffStatus,
    StaffUpdate,
)
from app.services import staff as staff_service

router = APIRouter(prefix="/staff", tags=["staff"])

LEVEL_BY_LABEL = {lvl.value: lvl for lvl in StaffLevel}


def _out(user: User) -> StaffOut:
    return StaffOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        level=staff_service.level_of(user),
        permissions=staff_service.effective_permissions(user),
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


def _target(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None or user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到後台帳號")
    return user


def _codes(codes: list[str]) -> list[str]:
    try:
        return staff_service.clean_codes(codes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/meta", response_model=StaffMeta, dependencies=[Depends(require_admin)])
def meta():
    """功能清單（名稱、是否含敏感資料）與內建角色範本。"""
    return StaffMeta(permissions=staff_service.permissions(), templates=staff_service.TEMPLATES)


@router.get("", response_model=list[StaffOut], dependencies=[Depends(require_owner)])
def list_staff(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role == UserRole.admin).order_by(User.id).all()
    order = {StaffLevel.owner: 0, StaffLevel.manager: 1, StaffLevel.staff: 2}
    return [_out(u) for u in sorted(users, key=lambda u: (not u.is_active, order[staff_service.level_of(u)], u.id))]


@router.post("", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
def create_staff(payload: StaffCreate, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    """新增後台帳號；第一次登入要自己改密碼。帳號和會員帳號共用同一個名稱空間。"""
    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="請輸入帳號")
    if db.query(User.id).filter(func.lower(User.username) == username.lower()).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="這個帳號已經被使用（會員或後台帳號）")
    level = LEVEL_BY_LABEL[payload.level]
    user = User(
        username=username,
        display_name=(payload.display_name or "").strip() or None,
        password_hash=hash_password(payload.password),
        role=UserRole.admin,
        staff_level=level,
        permissions=_codes(payload.permissions) if level == StaffLevel.staff else [],
        must_change_password=True,
    )
    db.add(user)
    db.flush()
    detail = level.value
    if level == StaffLevel.staff:
        detail += "：" + ("、".join(staff_service.label(c) for c in user.permissions) or "沒有任何功能")
    staff_service.audit(db, owner, "新增帳號", user, detail)
    db.commit()
    db.refresh(user)
    return _out(user)


@router.put("/{user_id}", response_model=StaffOut)
def update_staff(
    user_id: int, payload: StaffUpdate, owner: User = Depends(require_owner), db: Session = Depends(get_db)
):
    """修改名稱、升級為管理者／降回一般使用者、設定一般使用者的功能。主要管理者本身不能在這裡改身分。"""
    user = _target(db, user_id)
    data = payload.model_dump(exclude_unset=True)
    if "display_name" in data:
        user.display_name = (data["display_name"] or "").strip() or None
    current = staff_service.level_of(user)
    if current == StaffLevel.owner and (payload.level is not None or payload.permissions is not None):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="主要管理者擁有全部權限；要換人請用「移交主要管理者」")
    before_perms = staff_service.effective_permissions(user)
    if payload.level is not None:
        new_level = LEVEL_BY_LABEL[payload.level]
        if new_level != current:
            staff_service.audit(db, owner, "升級" if new_level == StaffLevel.manager else "降級", user,
                                f"{current.value} → {new_level.value}")
            user.staff_level = new_level
            if new_level == StaffLevel.staff and payload.permissions is None:
                # 降回一般使用者時沒指定功能：保留原本勾選的（從管理者降級則是沒有任何功能，需重新勾選）
                user.permissions = staff_service.clean_codes(user.permissions or [])
    if payload.permissions is not None:
        if staff_service.level_of(user) != StaffLevel.staff:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="管理者擁有全部功能，不需要勾選")
        user.permissions = _codes(payload.permissions)
        after = staff_service.effective_permissions(user)
        if after != before_perms:
            staff_service.audit(db, owner, "修改權限", user, staff_service.permission_diff(before_perms, after))
    db.commit()
    db.refresh(user)
    return _out(user)


@router.post("/{user_id}/status", response_model=StaffOut)
def set_status(user_id: int, payload: StaffStatus, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    """停用／啟用。停用後不能登入、已登入的也立刻失效；主要管理者與自己不能停用。"""
    user = _target(db, user_id)
    if staff_service.level_of(user) == StaffLevel.owner or user.id == owner.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="主要管理者不能停用；要換人請先移交")
    if user.is_active != payload.is_active:
        user.is_active = payload.is_active
        staff_service.audit(db, owner, "啟用" if payload.is_active else "停用", user)
    db.commit()
    db.refresh(user)
    return _out(user)


@router.post("/{user_id}/reset-password", response_model=StaffOut)
def reset_password(
    user_id: int, payload: StaffPassword, owner: User = Depends(require_owner), db: Session = Depends(get_db)
):
    """重設密碼，對方下次登入要自己改。主要管理者自己的密碼請用「修改密碼」。"""
    user = _target(db, user_id)
    if user.id == owner.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="自己的密碼請用「修改密碼」")
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = True
    staff_service.audit(db, owner, "重設密碼", user)
    db.commit()
    db.refresh(user)
    return _out(user)


@router.post("/transfer-owner", response_model=StaffOut)
def transfer_owner(payload: OwnerTransfer, owner: User = Depends(require_owner), db: Session = Depends(get_db)):
    """把主要管理者移交給另一個啟用中的後台帳號；自己變成管理者。要再輸入一次自己的密碼。"""
    if not verify_password(payload.password, owner.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="密碼不正確")
    target = _target(db, payload.user_id)
    if target.id == owner.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="已經是主要管理者")
    if not target.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能移交給已停用的帳號")
    owner.staff_level = StaffLevel.manager
    db.flush()
    target.staff_level = StaffLevel.owner
    staff_service.audit(db, owner, "移交主要管理者", target, f"{staff_service.describe(owner)} → {staff_service.describe(target)}")
    db.commit()
    db.refresh(target)
    return _out(target)


@router.get("/logs", response_model=list[StaffAuditOut], dependencies=[Depends(require_owner)])
def logs(limit: int = 50, db: Session = Depends(get_db)):
    return db.query(StaffAuditLog).order_by(StaffAuditLog.id.desc()).limit(max(1, min(limit, 200))).all()

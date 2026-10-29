"""
分店管理（ADR 0007）：所有登入者可讀（預約畫面要選分店）；新增、編輯、停用限管理員。
分店不能刪除（課程、預約都會引用），只能停用；最後一間啟用中的分店不能停用。
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, require_perm
from app.models.branch import Branch
from app.models.course import Course, CourseStatus
from app.models.user import User, UserRole
from app.schemas.branch import BranchCreate, BranchOut, BranchUpdate
from app.services import branches as branch_service

router = APIRouter(prefix="/branches", tags=["branches"])

# 後台功能權限（ADR 0008）：這個檔案的管理用 API 都屬於「branches」功能
require_access = require_perm("branches")


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


@router.get("", response_model=list[BranchOut])
def list_branches(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """依排序列出分店；會員只看得到啟用中的。一間都沒有時自動建立「總店」。"""
    if not branch_service.ordered(db).first():
        branch_service.default_branch(db)
        db.commit()
    query = branch_service.ordered(db)
    if current_user.role != UserRole.admin:
        query = query.filter(Branch.is_active.is_(True))
    return query.all()


def _commit_unique(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="已經有同名的分店")


@router.post("", response_model=BranchOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_access)])
def create_branch(payload: BranchCreate, db: Session = Depends(get_db)):
    branch_service.default_branch(db)  # 確保既有的「總店」先建立，新分店不會變成第一間
    branch = Branch(
        name=payload.name.strip(), address=_clean(payload.address), phone=_clean(payload.phone),
        sort_order=payload.sort_order,
    )
    db.add(branch)
    _commit_unique(db)
    db.refresh(branch)
    return branch


@router.put("/{branch_id}", response_model=BranchOut, dependencies=[Depends(require_access)])
def update_branch(branch_id: int, payload: BranchUpdate, db: Session = Depends(get_db)):
    branch = db.get(Branch, branch_id)
    if branch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到分店")
    data = payload.model_dump(exclude_unset=True)
    if data.get("is_active") is False and branch.is_active:
        others = db.query(Branch.id).filter(Branch.is_active.is_(True), Branch.id != branch.id).count()
        if others == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="至少要保留一間啟用中的分店")
        live = (
            db.query(Course.id)
            .filter(Course.branch_id == branch.id, Course.status == CourseStatus.on, Course.is_archived.is_(False))
            .count()
        )
        if live:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"這間分店還有 {live} 門上架中的課程，請先下架"
            )
    if "name" in data and data["name"] is not None:
        branch.name = data["name"].strip()
    for field in ("address", "phone"):
        if field in data:
            setattr(branch, field, _clean(data[field]))
    if data.get("sort_order") is not None:
        branch.sort_order = data["sort_order"]
    if data.get("is_active") is not None:
        branch.is_active = data["is_active"]
    _commit_unique(db)
    db.refresh(branch)
    return branch

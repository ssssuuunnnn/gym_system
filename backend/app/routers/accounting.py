"""
收支報表與手動記帳（ADR 0014、R57–R60）。全部需要「收支報表」權限（accounting）。
"""

from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.core import clock
from app.core.media import private_media_path, save_private_media
from app.deps import get_db, require_perm
from app.models.accounting import AccountingCategory, AccountingClose, AccountingEntry, EntryKind
from app.models.user import User
from app.schemas.accounting import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    CloseCreate,
    CloseOut,
    DeferredOut,
    EntryIn,
    EntryOut,
    ReportOut,
    TransactionOut,
    TrendPoint,
)
from app.services import accounting
from app.services.branches import check_branch_ids
from app.models.user import StaffLevel
from app.services.staff import describe, ensure_owner
from app.services.staff import level_of as staff_level_of

router = APIRouter(prefix="/accounting", tags=["accounting"])

require_access = require_perm("accounting")

BasisParam = Literal["cash", "accrual"]

# 收據（R64）：Content-Type → 副檔名、檔頭
RECEIPT_TYPES = {
    "image/jpeg": (".jpg", (b"\xff\xd8\xff",)),
    "image/png": (".png", (b"\x89PNG\r\n\x1a\n",)),
    "application/pdf": (".pdf", (b"%PDF-",)),
}
RECEIPT_MEDIA_TYPES = {ext: ctype for ctype, (ext, _) in RECEIPT_TYPES.items()}
RECEIPT_MAX_BYTES = 5 * 1024 * 1024


# ---------- 分類 ----------


def _category_out(db: Session, c: AccountingCategory) -> CategoryOut:
    return CategoryOut.model_validate(c).model_copy(update={"in_use": accounting.category_in_use(db, c.id)})


def _get_category(db: Session, category_id: int) -> AccountingCategory:
    c = db.get(AccountingCategory, category_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到分類")
    return c


def _name_taken(db: Session, kind: EntryKind, name: str, exclude_id: int | None = None) -> bool:
    q = db.query(AccountingCategory.id).filter(AccountingCategory.kind == kind, AccountingCategory.name == name)
    if exclude_id is not None:
        q = q.filter(AccountingCategory.id != exclude_id)
    return q.first() is not None


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(
    kind: EntryKind | None = None, _: User = Depends(require_access), db: Session = Depends(get_db)
):
    accounting.ensure_categories(db)
    db.commit()
    q = db.query(AccountingCategory)
    if kind is not None:
        q = q.filter(AccountingCategory.kind == kind)
    used = {cid for (cid,) in db.query(AccountingEntry.category_id).distinct()}
    return [
        CategoryOut.model_validate(c).model_copy(update={"in_use": c.id in used})
        for c in q.order_by(AccountingCategory.kind, AccountingCategory.sort_order, AccountingCategory.id)
    ]


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, _: User = Depends(require_access), db: Session = Depends(get_db)):
    if _name_taken(db, payload.kind, payload.name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="已經有同名的分類")
    last = (
        db.query(AccountingCategory.sort_order)
        .filter(AccountingCategory.kind == payload.kind)
        .order_by(AccountingCategory.sort_order.desc())
        .first()
    )
    c = AccountingCategory(kind=payload.kind, name=payload.name, sort_order=(last[0] + 1) if last else 0)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _category_out(db, c)


@router.put("/categories/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int, payload: CategoryUpdate, _: User = Depends(require_access), db: Session = Depends(get_db)
):
    c = _get_category(db, category_id)
    if payload.name is not None and payload.name != c.name:
        if _name_taken(db, c.kind, payload.name, exclude_id=c.id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="已經有同名的分類")
        c.name = payload.name
    if payload.is_active is not None:
        c.is_active = payload.is_active
    if payload.sort_order is not None:
        c.sort_order = payload.sort_order
    db.commit()
    db.refresh(c)
    return _category_out(db, c)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, _: User = Depends(require_access), db: Session = Depends(get_db)):
    """沒用過的分類才能刪除；用過的只能停用（R59）。"""
    c = _get_category(db, category_id)
    if accounting.category_in_use(db, c.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="這個分類已經有帳目，只能停用")
    db.delete(c)
    db.commit()


# ---------- 手動帳目 ----------


def _entry_out(e: AccountingEntry) -> EntryOut:
    return EntryOut.model_validate(e)


def _validate_entry(db: Session, payload: EntryIn, current: AccountingEntry | None = None) -> None:
    c = db.get(AccountingCategory, payload.category_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="找不到分類")
    if c.kind != payload.kind:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"「{c.name}」不是{payload.kind.value}分類")
    # 停用的分類不能再用來新增；修改舊帳目時保留原分類可以
    if not c.is_active and (current is None or current.category_id != c.id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"「{c.name}」已停用")
    if payload.branch_id is not None:
        check_branch_ids(db, [payload.branch_id])


def _get_entry(db: Session, entry_id: int) -> AccountingEntry:
    e = db.get(AccountingEntry, entry_id)
    if e is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到帳目")
    return e


@router.get("/entries", response_model=list[EntryOut])
def list_entries(
    start: date,
    end: date,
    kind: EntryKind | None = None,
    branch_id: int | None = None,
    include_deleted: bool = False,
    _: User = Depends(require_access),
    db: Session = Depends(get_db),
):
    accounting.check_range(start, end)
    q = (
        db.query(AccountingEntry)
        .options(joinedload(AccountingEntry.category))
        .filter(AccountingEntry.entry_date >= start, AccountingEntry.entry_date <= end)
    )
    if kind is not None:
        q = q.filter(AccountingEntry.kind == kind)
    if branch_id is not None:
        q = q.filter(AccountingEntry.branch_id == branch_id)
    if not include_deleted:
        q = q.filter(AccountingEntry.deleted_at.is_(None))
    return [_entry_out(e) for e in q.order_by(AccountingEntry.entry_date.desc(), AccountingEntry.id.desc())]


@router.post("/entries", response_model=EntryOut, status_code=status.HTTP_201_CREATED)
def create_entry(payload: EntryIn, user: User = Depends(require_access), db: Session = Depends(get_db)):
    _validate_entry(db, payload)
    accounting.ensure_open(db, payload.entry_date)
    now = datetime.utcnow()
    e = AccountingEntry(
        **payload.model_dump(), created_by_name=describe(user), updated_by_name=describe(user),
        created_at=now, updated_at=now,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return _entry_out(e)


@router.put("/entries/{entry_id}", response_model=EntryOut)
def update_entry(entry_id: int, payload: EntryIn, user: User = Depends(require_access), db: Session = Depends(get_db)):
    e = _get_entry(db, entry_id)
    if e.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="已刪除的帳目不能修改")
    _validate_entry(db, payload, current=e)
    accounting.ensure_open(db, e.entry_date, payload.entry_date)
    for field, value in payload.model_dump().items():
        setattr(e, field, value)
    e.updated_by_name = describe(user)
    e.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(e)
    return _entry_out(e)


@router.delete("/entries/{entry_id}", response_model=EntryOut)
def delete_entry(entry_id: int, user: User = Depends(require_access), db: Session = Depends(get_db)):
    """軟刪除：保留紀錄（誰、什麼時候刪的），報表不計（R59）。"""
    e = _get_entry(db, entry_id)
    if e.deleted_at is None:
        accounting.ensure_open(db, e.entry_date)
        e.deleted_at = datetime.utcnow()
        e.deleted_by_name = describe(user)
        db.commit()
        db.refresh(e)
    return _entry_out(e)


# ---------- 收據（R64） ----------


@router.post("/entries/{entry_id}/receipt", response_model=EntryOut)
async def upload_receipt(
    entry_id: int,
    file: UploadFile = File(...),
    user: User = Depends(require_access),
    db: Session = Depends(get_db),
):
    e = _get_entry(db, entry_id)
    if e.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="已刪除的帳目不能修改")
    accounting.ensure_open(db, e.entry_date)
    kind = RECEIPT_TYPES.get(file.content_type or "")
    if kind is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="收據只接受 JPG、PNG 或 PDF")
    data = await file.read()
    if len(data) > RECEIPT_MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="收據檔案不能超過 5MB")
    ext, magics = kind
    if not any(data.startswith(m) for m in magics):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="檔案內容與格式不符")
    e.receipt_path = save_private_media("receipts", data, ext)
    e.updated_by_name = describe(user)
    e.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(e)
    return _entry_out(e)


@router.get("/entries/{entry_id}/receipt")
def get_receipt(entry_id: int, _: User = Depends(require_access), db: Session = Depends(get_db)):
    """收據檔案：只能經過這支 API 讀取（不在公開的 /media）；刪除的帳目也能看。"""
    e = _get_entry(db, entry_id)
    path = private_media_path(e.receipt_path) if e.receipt_path else None
    if path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="沒有收據")
    ext = "." + path.rsplit(".", 1)[-1].lower()
    return FileResponse(
        path,
        media_type=RECEIPT_MEDIA_TYPES.get(ext, "application/octet-stream"),
        filename=f"receipt-{e.id}{ext}",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/entries/{entry_id}/receipt", response_model=EntryOut)
def delete_receipt(entry_id: int, user: User = Depends(require_access), db: Session = Depends(get_db)):
    e = _get_entry(db, entry_id)
    if e.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="已刪除的帳目不能修改")
    accounting.ensure_open(db, e.entry_date)
    e.receipt_path = None
    e.updated_by_name = describe(user)
    e.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(e)
    return _entry_out(e)


# ---------- 報表 ----------


@router.get("/report", response_model=ReportOut)
def get_report(
    start: date,
    end: date,
    branch_id: int | None = None,
    basis: BasisParam = "cash",
    _: User = Depends(require_access),
    db: Session = Depends(get_db),
):
    return accounting.report(db, start, end, branch_id, basis)


@router.get("/trend", response_model=list[TrendPoint])
def get_trend(
    months: int = Query(12, ge=1, le=accounting.MAX_TREND_MONTHS),
    branch_id: int | None = None,
    basis: BasisParam = "cash",
    _: User = Depends(require_access),
    db: Session = Depends(get_db),
):
    return accounting.trend(db, months, branch_id, basis)


@router.get("/transactions", response_model=list[TransactionOut])
def list_transactions(
    start: date,
    end: date,
    branch_id: int | None = None,
    kind: EntryKind | None = None,
    basis: BasisParam = "cash",
    _: User = Depends(require_access),
    db: Session = Depends(get_db),
):
    accounting.check_range(start, end)
    rows = accounting.transactions(db, start, end, branch_id, basis)
    if kind is not None:
        rows = [r for r in rows if r.kind == kind]
    return [r.as_dict() for r in rows]


@router.get("/deferred", response_model=DeferredOut)
def get_deferred(
    as_of: date | None = None,
    branch_id: int | None = None,
    _: User = Depends(require_access),
    db: Session = Depends(get_db),
):
    """預收款（R62）；不填日期＝今天。"""
    return accounting.deferred(db, as_of or clock.now_local().date(), branch_id)


# ---------- 關帳（R63） ----------


def _parse_month(month: str) -> date:
    try:
        return datetime.strptime(month, "%Y-%m").date().replace(day=1)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="月份格式為 YYYY-MM")


@router.get("/closes", response_model=list[CloseOut])
def list_closes(_: User = Depends(require_access), db: Session = Depends(get_db)):
    return db.query(AccountingClose).order_by(AccountingClose.period.desc()).all()


@router.post("/closes", response_model=CloseOut, status_code=status.HTTP_201_CREATED)
def close_month(payload: CloseCreate, user: User = Depends(require_access), db: Session = Depends(get_db)):
    """關帳：只能關已結束的月份；存下該月現金制、權責制數字與月底預收款的快照。"""
    period = _parse_month(payload.month)
    if clock.now_local().date() <= accounting.month_end(period):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="只能關已結束的月份")
    row = db.query(AccountingClose).filter(AccountingClose.period == period).with_for_update().first()
    if row is not None and row.is_closed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="這個月已經關帳")
    snapshot = accounting.month_snapshot(db, period)
    if row is None:
        row = AccountingClose(period=period)
        db.add(row)
    row.is_closed = True
    row.closed_at = datetime.utcnow()
    row.closed_by_name = describe(user)
    row.snapshot = snapshot
    db.commit()
    db.refresh(row)
    return row


@router.post("/closes/{month}/reopen", response_model=CloseOut)
def reopen_month(month: str, user: User = Depends(require_access), db: Session = Depends(get_db)):
    """重新開帳：只有主要管理者可以（R63）。"""
    if staff_level_of(user) != StaffLevel.owner:
        owner = ensure_owner(db)
        db.commit()
        if owner is None or owner.id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有主要管理者可以重新開帳")
    period = _parse_month(month)
    row = db.query(AccountingClose).filter(AccountingClose.period == period).first()
    if row is None or not row.is_closed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="這個月沒有關帳")
    row.is_closed = False
    row.reopened_at = datetime.utcnow()
    row.reopened_by_name = describe(user)
    db.commit()
    db.refresh(row)
    return row

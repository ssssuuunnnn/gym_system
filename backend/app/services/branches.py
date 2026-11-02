"""
分店（見 docs/adr/0007-branches.md）。

- default_branch：排序最前面的啟用分店；一家都沒有時建立「總店」（新開通的健身房、測試資料）
- active_branch：取得並檢查分店存在且啟用（新增課程、預約時用）
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.branch import DEFAULT_BRANCH_NAME, Branch


def ordered(db: Session):
    return db.query(Branch).order_by(Branch.sort_order, Branch.id)


def default_branch(db: Session) -> Branch:
    with db.no_autoflush:
        branch = ordered(db).filter(Branch.is_active.is_(True)).first() or ordered(db).first()
        if branch is None:
            # 同一個交易裡剛建立、還沒寫入的「總店」
            branch = next((o for o in db.new if isinstance(o, Branch)), None)
        if branch is None:
            branch = Branch(name=DEFAULT_BRANCH_NAME, tenant_id=db.info.get("tenant_id"))
            db.add(branch)
    return branch


def active_branch(db: Session, branch_id: int | None) -> Branch:
    """branch_id 為 None 時回傳預設分店；指定的分店不存在或已停用回 400。"""
    if branch_id is None:
        return default_branch(db)
    branch = db.get(Branch, branch_id)
    if branch is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="找不到分店")
    if not branch.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"「{branch.name}」已停用")
    return branch


def check_branch_ids(db: Session, ids: list[int]) -> list[int]:
    """確認每個分店都存在（同一家公司，RLS 已限制），去除重複。"""
    unique = list(dict.fromkeys(ids))
    if unique:
        found = {b.id for b in db.query(Branch.id).filter(Branch.id.in_(unique))}
        if len(found) != len(unique):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="找不到分店")
    return unique


def has_multiple(db: Session) -> bool:
    return db.query(Branch.id).filter(Branch.is_active.is_(True)).count() > 1


def label_for(db: Session, branch_id: int | None) -> str | None:
    """通知卡片用：有兩間以上分店時才寫分店名稱（只有一間時不多佔一行）。"""
    if branch_id is None or not has_multiple(db):
        return None
    branch = db.get(Branch, branch_id)
    return branch.name if branch else None


def product_branch_id(db: Session, product_id: int) -> int | None:
    """方案本身決定的分店（R58）：團體課程方案 → 課程的分店；只限一間分店的方案 → 那間。其他回 None。"""
    from app.models.product import Product

    with db.no_autoflush:
        product = db.get(Product, product_id)
        if product is None:
            return None
        if product.course is not None:
            return product.course.branch_id
        ids = product.branch_ids
        return ids[0] if len(ids) == 1 else None


def purchase_branch_id(db: Session, product_id: int, requested: int | None = None) -> int:
    """
    購買紀錄的分店（R58）：方案決定的分店優先；否則用指定的分店（必須存在、啟用，且在方案適用分店內）；
    都沒有就用預設分店。
    """
    from app.models.product import Product

    fixed = product_branch_id(db, product_id)
    if fixed is not None:
        return fixed
    if requested is not None:
        branch = active_branch(db, requested)
        product = db.get(Product, product_id)
        if product is not None and product.branch_ids and branch.id not in product.branch_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"此方案不適用「{branch.name}」")
        return branch.id
    branch = default_branch(db)
    if branch.id is None:
        db.flush([branch])
    return branch.id

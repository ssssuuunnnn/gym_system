from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user, require_admin
from app.models.product import Product, ProductCategory
from app.models.purchase import Purchase
from app.models.user import User, UserRole
from app.schemas.purchase import PurchaseCreate, PurchaseOut, PurchaseSelfCreate

router = APIRouter(prefix="/purchases", tags=["purchases"])


def _build_purchase(db: Session, *, user_id: int, product_id: int, quantity: int, purchase_date: date, amount: float, created_by: int) -> Purchase:
    """
    共用購買建立邏輯（「購買紀錄登錄」與會員「購買商品」皆走這裡）：
    課程類商品 remaining_hours = 商品堂數 * 數量；用品扣減 products.stock 且 remaining_hours = 0。
    """
    member = db.get(User, user_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到會員")

    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到商品")

    if product.category == ProductCategory.supply:
        if product.stock is None or product.stock < quantity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="庫存不足")
        product.stock -= quantity
        remaining_hours = 0
    else:
        remaining_hours = product.session_hours * quantity

    purchase = Purchase(
        user_id=user_id,
        product_id=product_id,
        quantity=quantity,
        purchase_date=purchase_date,
        amount=amount,
        remaining_hours=remaining_hours,
        created_by=created_by,
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return purchase


@router.get("", response_model=list[PurchaseOut])
def list_purchases(
    user_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    對應「教練購買紀錄查詢」（管理員，可用 user_id 篩選單一會員，購買對象不限教練身份）
    與「我的商品／庫存」（會員，僅能查詢自己的購買紀錄）。
    """
    query = db.query(Purchase)
    if current_user.role != UserRole.admin:
        query = query.filter(Purchase.user_id == current_user.id)
    elif user_id is not None:
        query = query.filter(Purchase.user_id == user_id)
    return query.all()


@router.post("", response_model=PurchaseOut, status_code=status.HTTP_201_CREATED)
def create_purchase(payload: PurchaseCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """
    對應「購買紀錄登錄」：選擇會員、選擇商品、數量、購買日期、金額。
    課程商品：remaining_hours = 商品堂數 * 數量；用品：扣減 products.stock，remaining_hours = 0。
    """
    return _build_purchase(
        db,
        user_id=payload.user_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        purchase_date=payload.purchase_date,
        amount=payload.amount,
        created_by=admin.id,
    )


@router.post("/self", response_model=PurchaseOut, status_code=status.HTTP_201_CREATED)
def create_self_purchase(
    payload: PurchaseSelfCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    對應會員「購買商品」：登入會員為自己購買。歸屬對象一律為登入者本人，
    金額與購買日期由後端依商品單價 × 數量、當日日期帶入，不採用前端傳入值。
    """
    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到商品")
    if not product.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此商品未上架")

    return _build_purchase(
        db,
        user_id=current_user.id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        purchase_date=date.today(),
        amount=float(product.price) * payload.quantity,
        created_by=current_user.id,
    )

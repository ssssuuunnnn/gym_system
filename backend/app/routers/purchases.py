from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user, require_admin
from app.models.product import Product
from app.models.purchase import Purchase
from app.models.user import User, UserRole
from app.schemas.purchase import PurchaseCreate, PurchaseOut

router = APIRouter(prefix="/purchases", tags=["purchases"])


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
    """對應「購買紀錄登錄」：選擇會員、選擇商品、數量、購買日期、金額。remaining_hours = 商品堂數 * 數量。"""
    member = db.get(User, payload.user_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到會員")

    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到商品")

    purchase = Purchase(
        **payload.model_dump(),
        remaining_hours=product.session_hours * payload.quantity,
        created_by=admin.id,
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return purchase

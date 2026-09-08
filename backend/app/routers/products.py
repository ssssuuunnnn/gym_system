from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user, require_admin
from app.models.course import Course, CourseStatus
from app.models.product import Product, ProductCategory
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


def _normalize_product_fields(db: Session, data: dict, previous_course_id: int | None = None) -> None:
    """
    依分類補齊／清理衍生欄位（原地修改 data）：
    - 課程：course_id 必填且課程須存在；綁定新課程時須為「上架」；session_hours 沿用課程課堂數；stock 清為 None。
    - 用品：stock 必填且 >= 0；session_hours 固定 0；course_id 清為 None。
    （綁定不變時不強制上架，避免課程事後下架就無法再編輯該商品。）
    """
    category = data.get("category")
    if category == ProductCategory.course:
        course_id = data.get("course_id")
        if course_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="分類為課程時請選擇綁定的課程")
        course = db.get(Course, course_id)
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到課程")
        if course_id != previous_course_id and course.status != CourseStatus.on:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="只能綁定上架中的課程")
        data["session_hours"] = course.session_count
        data["stock"] = None
    elif category == ProductCategory.supply:
        stock = data.get("stock")
        if stock is None or stock < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="分類為用品時請輸入非負的庫存量")
        data["session_hours"] = 0
        data["course_id"] = None


@router.get("", response_model=list[ProductOut], dependencies=[Depends(get_current_user)])
def list_products(db: Session = Depends(get_db)):
    """
    對應「商品管理列表」（管理員）；其他登入會員可讀取用於購買／預約畫面顯示商品資訊
    （如「我的商品／庫存」「送出預約申請」），僅新增／編輯限管理員。
    """
    return db.query(Product).all()


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    """對應「建立／編輯商品」：商品名稱、分類（課程／用品）、價格、上架狀態。"""
    data = payload.model_dump()
    _normalize_product_fields(db, data)
    product = Product(**data)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductOut, dependencies=[Depends(require_admin)])
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到商品")

    updates = payload.model_dump(exclude_unset=True)
    # 以「更新後的完整狀態」重新推導衍生欄位（分類或綁定課程變動時需重算 session_hours）
    merged = {
        "category": updates.get("category", product.category),
        "course_id": updates.get("course_id", product.course_id),
        "stock": updates.get("stock", product.stock),
    }
    _normalize_product_fields(db, merged, previous_course_id=product.course_id)
    updates["category"] = merged["category"]
    updates["course_id"] = merged["course_id"]
    updates["stock"] = merged["stock"]
    updates["session_hours"] = merged["session_hours"]

    for field, value in updates.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product

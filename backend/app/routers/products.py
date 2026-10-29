from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_db
from app.deps import get_current_user, require_perm
from app.models.course import Course, CourseStatus
from app.models.product import Product, ProductCategory
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

from app.services import branches as branch_service

router = APIRouter(prefix="/products", tags=["products"])

# 後台功能權限（ADR 0008）：這個檔案的管理用 API 都屬於「products」功能
require_access = require_perm("products")


def _normalize_product_fields(db: Session, data: dict, previous_course_id: int | None = None) -> None:
    """
    依分類補齊／清理衍生欄位（原地修改 data）：
    - 團體課程：course_id 必填且課程須存在；綁定新課程時須為「上架」；session_hours 沿用課程課堂數；stock 清為 None。
      （綁定不變時不強制上架，避免課程事後下架就無法再編輯該商品。）
    - 課程（單次課程）：session_hours 必填且 >= 1（管理員自填）；course_id、stock 清為 None。
    - 用品：stock 必填且 >= 0；session_hours 固定 0；course_id 清為 None。
    - 限定分店（branch_ids）只有「課程」可設：團體課程跟著課程的分店、用品不需要（R35）。
    """
    category = data.get("category")
    if "branch_ids" in data:
        ids = data.get("branch_ids") or []
        data["branch_ids"] = branch_service.check_branch_ids(db, ids) if category == ProductCategory.single_course else []
    if category == ProductCategory.course:
        course_id = data.get("course_id")
        if course_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="分類為團體課程時請選擇綁定的課程")
        course = db.get(Course, course_id)
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到課程")
        if course_id != previous_course_id and course.status != CourseStatus.on:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="只能綁定上架中的課程")
        data["session_hours"] = course.session_count
        data["stock"] = None
    elif category == ProductCategory.single_course:
        session_hours = data.get("session_hours")
        if session_hours is None or session_hours < 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="分類為課程時請輸入至少 1 堂")
        data["course_id"] = None
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


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_access)])
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    """對應「建立／編輯商品」：商品名稱、分類（團體課程／課程／用品）、價格、上架狀態。"""
    data = payload.model_dump()
    _normalize_product_fields(db, data)
    product = Product(**data)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductOut, dependencies=[Depends(require_access)])
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到商品")

    updates = payload.model_dump(exclude_unset=True)
    # 以「更新後的完整狀態」重新推導衍生欄位（分類或綁定課程變動時需重算 session_hours）
    merged = {
        "category": updates.get("category", product.category),
        "course_id": updates.get("course_id", product.course_id),
        "session_hours": updates.get("session_hours", product.session_hours),
        "stock": updates.get("stock", product.stock),
        "branch_ids": updates["branch_ids"] if updates.get("branch_ids") is not None else product.branch_ids,
    }
    _normalize_product_fields(db, merged, previous_course_id=product.course_id)
    updates["category"] = merged["category"]
    updates["course_id"] = merged["course_id"]
    updates["session_hours"] = merged["session_hours"]
    updates["stock"] = merged["stock"]
    updates["branch_ids"] = merged["branch_ids"]

    for field, value in updates.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product

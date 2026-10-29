
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.media import save_tenant_media
from app.deps import get_db
from app.deps import get_current_user, require_perm, require_coach
from app.models.coach import Coach
from app.models.course import Course, CourseStatus
from app.models.user import User, UserRole
from app.schemas.coach import CoachCreate, CoachOut, CoachPhotoOut, CoachUpdate
from app.services.staff import has_perm
from app.services import branches as branch_service

router = APIRouter(prefix="/coaches", tags=["coaches"])

# 後台功能權限（ADR 0008）：這個檔案的管理用 API 都屬於「coaches」功能
require_access = require_perm("coaches")

# 教練照片：僅接受 jpg、png，單檔 2MB 以內（與「新增教練」設計稿一致）
PHOTO_CONTENT_TYPES = {"image/jpeg": ".jpg", "image/png": ".png"}
PHOTO_MAX_BYTES = 2 * 1024 * 1024


# 僅管理員可見的欄位：非管理員讀取教練列表時清空
_ADMIN_ONLY_FIELDS = {"phone": None, "line_name": None, "bank_code": None, "bank_account": None, "session_rate": None}


@router.get("", response_model=list[CoachOut])
def list_coaches(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    對應「教練資料列表」（管理員）；其他登入會員可讀取用於預約畫面顯示教練姓名
    （如「我的預約列表」「送出預約申請」），僅新增／編輯／刪除限管理員。
    非管理員看不到電話、Line、匯款帳號與鐘點費。
    """
    coaches = db.query(Coach).all()
    # 電話、匯款帳號、鐘點費只給有「教練管理」或「教練鐘點」權限的後台帳號（ADR 0008）
    if has_perm(current_user, "coaches", "payouts"):
        return coaches
    return [CoachOut.model_validate(c).model_copy(update=_ADMIN_ONLY_FIELDS) for c in coaches]


@router.get("/me", response_model=CoachOut)
def my_coach_profile(coach: Coach = Depends(require_coach)):
    """教練本人的教練資料（含教練類型，前端依此決定側欄顯示「我的鐘點」等）。"""
    return coach


@router.post(
    "/upload-photo",
    response_model=CoachPhotoOut,
    dependencies=[Depends(require_access)],
)
async def upload_photo(file: UploadFile = File(...)):
    """對應「新增教練」教練照片上傳：存檔後回傳 /media 相對網址供寫入 photo_url。"""
    ext = PHOTO_CONTENT_TYPES.get(file.content_type or "")
    if ext is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="僅支援 jpg、png 格式")

    data = await file.read()
    if len(data) > PHOTO_MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="檔案超過 2MB，請壓縮後再上傳")

    return CoachPhotoOut(url=save_tenant_media("coaches", data, ext))


@router.post("", response_model=CoachOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_access)])
def create_coach(payload: CoachCreate, db: Session = Depends(get_db)):
    """對應「建立／編輯教練資料」：綁定會員帳號、名稱、電話等。一帳號僅能綁定一筆教練資料。"""
    member = db.get(User, payload.user_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="找不到要綁定的會員帳號")

    existing = db.query(Coach).filter(Coach.user_id == payload.user_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此帳號已綁定教練資料")

    data = payload.model_dump()
    coach_types = data.pop("coach_types")
    branch_ids = branch_service.check_branch_ids(db, data.pop("branch_ids"))
    coach = Coach(**data)
    coach.coach_types = coach_types
    # 沒選分店：寫入時由 db/session 的 before_flush 補上預設分店（可能是這次才建立的「總店」）
    coach.branch_ids = branch_ids
    db.add(coach)
    db.commit()
    db.refresh(coach)
    return coach


@router.put("/{coach_id}", response_model=CoachOut, dependencies=[Depends(require_access)])
def update_coach(coach_id: int, payload: CoachUpdate, db: Session = Depends(get_db)):
    coach = db.get(Coach, coach_id)
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到教練資料")
    data = payload.model_dump(exclude_unset=True)
    if "branch_ids" in data:
        branch_ids = branch_service.check_branch_ids(db, data.pop("branch_ids") or [])
        if not branch_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="請至少選擇一間授課分店")
        # 拿掉的分店還有這位教練的上架課程時不能拿掉（課程的教練必須在該分店授課）
        removed = set(coach.branch_ids) - set(branch_ids)
        if removed:
            live = (
                db.query(Course.name)
                .filter(
                    Course.coach_id == coach.id,
                    Course.branch_id.in_(removed),
                    Course.status == CourseStatus.on,
                    Course.is_archived.is_(False),
                )
                .first()
            )
            if live:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"「{live.name}」還在那間分店上架，請先換教練或下架後再移除分店",
                )
        coach.branch_ids = branch_ids
    for field, value in data.items():
        setattr(coach, field, value)
    db.commit()
    db.refresh(coach)
    return coach


@router.delete("/{coach_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_access)])
def delete_coach(coach_id: int, db: Session = Depends(get_db)):
    coach = db.get(Coach, coach_id)
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到教練資料")
    db.delete(coach)
    db.commit()

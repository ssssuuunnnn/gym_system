
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.media import save_tenant_media
from app.deps import get_db
from app.deps import get_current_user, require_perm
from app.models.system_settings import SystemSettings
from app.schemas.system_settings import SystemSettingsLogoOut, SystemSettingsOut, SystemSettingsUpdate
from app.services import terms

router = APIRouter(prefix="/system-settings", tags=["system-settings"])

# 後台功能權限（ADR 0008）：這個檔案的管理用 API 都屬於「settings」功能
require_access = require_perm("settings")

# 公司 LOGO：僅接受 jpg、png，單檔 2MB 以內（與教練照片上傳一致；不開放 svg，避免內嵌腳本的儲存型 XSS 風險）
LOGO_CONTENT_TYPES = {"image/jpeg": ".jpg", "image/png": ".png"}
LOGO_MAX_BYTES = 2 * 1024 * 1024



def _get_or_create_settings(db: Session) -> SystemSettings:
    """全站僅一筆設定；不存在時以預設值建立（idempotent，供 GET/PUT 共用）。"""
    settings_row = db.query(SystemSettings).first()
    if settings_row is None:
        # 尚未設定時的預設公司名稱依行業（健身／美體工作室管理系統）
        settings_row = SystemSettings(company_name=terms.t("system_name"))
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


@router.get("", response_model=SystemSettingsOut, dependencies=[Depends(get_current_user)])
def get_system_settings(db: Session = Depends(get_db)):
    """對應「系統設定 → 基本資料」；任何已登入使用者皆可讀取，供後台側欄與會員 App 顯示品牌資訊。"""
    return _get_or_create_settings(db)


@router.put("", response_model=SystemSettingsOut, dependencies=[Depends(require_access)])
def update_system_settings(payload: SystemSettingsUpdate, db: Session = Depends(get_db)):
    settings_row = _get_or_create_settings(db)
    data = payload.model_dump(exclude_unset=True)
    if "company_name" in data and not data["company_name"].strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="公司名稱不可空白")
    if "group_classes_enabled" in data:
        settings_row.group_classes_setting = data.pop("group_classes_enabled")
    for field, value in data.items():
        setattr(settings_row, field, value)
    db.commit()
    db.refresh(settings_row)
    return settings_row


@router.post(
    "/upload-logo",
    response_model=SystemSettingsLogoOut,
    dependencies=[Depends(require_access)],
)
async def upload_logo(file: UploadFile = File(...)):
    """對應「系統設定」公司 LOGO 上傳：存檔後回傳 /media 相對網址，需另呼叫 PUT 寫入 logo_url。"""
    ext = LOGO_CONTENT_TYPES.get(file.content_type or "")
    if ext is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="僅支援 jpg、png 格式")

    data = await file.read()
    if len(data) > LOGO_MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="檔案超過 2MB，請壓縮後再上傳")

    return SystemSettingsLogoOut(url=save_tenant_media("system", data, ext))

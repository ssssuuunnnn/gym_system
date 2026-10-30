"""
這家店的行業類型與功能開關（ADR 0011）：前端依此切換用詞、隱藏用不到的功能。
不需登入（登入頁、LINE 加入會員頁也要用），只回傳不敏感的設定。
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.tenant_context import TenantInfo
from app.deps import get_db, get_tenant
from app.models.system_settings import SystemSettings
from app.models.tenant import BusinessType
from app.services import terms
from app.services.shop import shop_names

router = APIRouter(prefix="/tenant", tags=["tenant"])


class TenantProfile(BaseModel):
    # 店家名稱（系統設定的簡稱，沒有就用公司名稱）：網頁標題、登入頁用
    name: str
    business_type: BusinessType
    group_classes_enabled: bool


@router.get("/profile", response_model=TenantProfile)
def tenant_profile(tenant: TenantInfo = Depends(get_tenant), db: Session = Depends(get_db)):
    row = db.query(SystemSettings).first()
    enabled = row.group_classes_enabled if row else terms.GROUP_CLASSES_DEFAULT[tenant.business_type]
    # 簡稱 → 公司名稱 → 平台開通時填的名稱（預設的「…管理系統」不算店名）
    name = shop_names(db, tenant.id, row).short
    return TenantProfile(name=name, business_type=BusinessType[tenant.business_type], group_classes_enabled=enabled)

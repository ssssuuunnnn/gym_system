"""
這家店的行業類型與功能開關（ADR 0011）：前端依此切換用詞、隱藏用不到的功能。
不需登入（登入頁、LINE 加入會員頁也要用），只回傳不敏感的設定。
試用中的店家另外帶試用到期日與平台聯絡方式（ADR 0013）；試用到期後這是唯一還能呼叫的店家 API。
"""

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.tenant_context import TenantInfo
from app.deps import get_db, get_tenant
from app.models.system_settings import SystemSettings
from app.models.website import Website
from app.schemas.website import BRAND_COLORS
from app.models.tenant import BusinessType, Tenant, TenantStatus, trial_expired
from app.services import terms
from app.services import trial as trial_service
from app.services.shop import shop_names

router = APIRouter(prefix="/tenant", tags=["tenant"])


class PlatformContact(BaseModel):
    """平台的聯絡方式（只有平台設定為顯示的欄位）：試用提醒與到期頁用。"""

    brand_name: str
    email: str | None = None
    line: str | None = None
    line_url: str | None = None
    phone: str | None = None


class TrialInfo(BaseModel):
    """試用狀態（ADR 0013）：只有狀態為試用且有到期日的店家才有。"""

    ends_at: datetime
    days_left: int
    expired: bool
    contact: PlatformContact


class TenantProfile(BaseModel):
    # 店家名稱（系統設定的簡稱，沒有就用公司名稱）：網頁標題、登入頁用
    name: str
    business_type: BusinessType
    group_classes_enabled: bool
    trial: TrialInfo | None = None
    # 形象網站的品牌色（已發布的版本；從沒發布過就用草稿）：會員前台的主色。沒有網站時為 None（前台用預設色）
    brand_color: str | None = None


def _brand_color(db: Session) -> str | None:
    site = db.query(Website).first()
    if site is None:
        return None
    content = site.published or site.draft or {}
    color = content.get("brand_color") if isinstance(content, dict) else None
    # 只回傳預設色票裡的顏色（都確認過對比）
    return color if color in BRAND_COLORS else None


@router.get("/profile", response_model=TenantProfile)
def tenant_profile(tenant: TenantInfo = Depends(get_tenant), db: Session = Depends(get_db)):
    row = db.query(SystemSettings).first()
    enabled = row.group_classes_enabled if row else terms.GROUP_CLASSES_DEFAULT[tenant.business_type]
    # 簡稱 → 公司名稱 → 平台開通時填的名稱（預設的「…管理系統」不算店名）
    name = shop_names(db, tenant.id, row).short
    trial = None
    record = db.get(Tenant, tenant.id)
    if record is not None and record.status == TenantStatus.trial and record.trial_ends_at is not None:
        contact = trial_service.public_contact(db)
        trial = TrialInfo(
            ends_at=record.trial_ends_at,
            days_left=trial_service.days_left(record.status, record.trial_ends_at) or 0,
            expired=trial_expired(record.status, record.trial_ends_at),
            contact=PlatformContact(
                brand_name=contact.brand_name, email=contact.email, line=contact.line,
                line_url=contact.line_url, phone=contact.phone,
            ),
        )
    return TenantProfile(
        name=name, business_type=BusinessType[tenant.business_type], group_classes_enabled=enabled, trial=trial,
        brand_color=_brand_color(db),
    )

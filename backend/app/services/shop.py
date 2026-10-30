"""
店家名稱（網頁標題、形象網站、登入頁共用）。

順序：系統設定的簡稱 → 公司名稱 → 平台開通時填的名稱（tenants.name）。
系統設定第一次讀取時公司名稱預設是「健身／美體工作室管理系統」，這不是店名，視同沒填。
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.system_settings import SystemSettings
from app.models.tenant import Tenant
from app.services import terms

# 系統設定的預設公司名稱（兩種行業都算）
DEFAULT_COMPANY_NAMES = {table["system_name"] for table in terms.TERMS.values()}


@dataclass
class ShopNames:
    # 簡稱（沒有就是全名）：分頁標題、頁首
    short: str
    # 全名：搜尋結果、分享卡片、結構化資料
    full: str


def _real(name: str | None) -> str | None:
    name = (name or "").strip()
    return name if name and name not in DEFAULT_COMPANY_NAMES else None


def shop_names(db: Session, tenant_id: int, settings_row: SystemSettings | None = None) -> ShopNames:
    row = settings_row if settings_row is not None else db.query(SystemSettings).first()
    company = _real(row.company_name) if row else None
    short = _real(row.short_name) if row else None
    full = company or _real(db.query(Tenant.name).filter(Tenant.id == tenant_id).scalar())
    full = full or short or terms.t("system_name")
    return ShopNames(short=short or full, full=full)

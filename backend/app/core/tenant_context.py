"""
目前請求的租戶（contextvar）。由 deps.get_tenant（async dependency，與請求同一個 context）設定，
供不經過資料庫的程式讀取，例如 clock.now_local() 取租戶時區、上傳檔案的資料夾。
資料隔離不依賴這裡：資料庫層由 RLS 以 Session 上的租戶強制。
"""

from contextvars import ContextVar
from dataclasses import dataclass


@dataclass(frozen=True)
class TenantInfo:
    id: int
    subdomain: str
    timezone: str
    # 行業類型（BusinessType 的成員名稱 fitness／beauty），決定用詞（services/terms.py）
    business_type: str = "fitness"


current_tenant: ContextVar[TenantInfo | None] = ContextVar("current_tenant", default=None)

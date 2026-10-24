"""
租戶當地時間。預約的 booking_date + start_hour 存的是健身房當地時間（不帶時區），
所以判斷「距離開課還有多久」時，現在時間也要換成同一時區、不帶時區的 datetime 再比較。
時區取目前租戶的 tenants.timezone，沒有租戶時用設定 STUDIO_TIMEZONE。

測試以 monkeypatch 取代 now_local；呼叫端請用 `clock.now_local()`（模組屬性），不要
`from app.core.clock import now_local`，否則替換不到。
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.core.tenant_context import current_tenant


def now_local() -> datetime:
    tenant = current_tenant.get()
    tz = tenant.timezone if tenant else settings.STUDIO_TIMEZONE
    return datetime.now(ZoneInfo(tz)).replace(tzinfo=None)

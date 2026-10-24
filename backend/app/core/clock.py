"""
工作室當地時間。預約的 booking_date + start_hour 存的是工作室當地時間（不帶時區），
所以判斷「距離開課還有多久」時，現在時間也要換成同一時區、不帶時區的 datetime 再比較。

測試以 monkeypatch 取代 now_local；呼叫端請用 `clock.now_local()`（模組屬性），不要
`from app.core.clock import now_local`，否則替換不到。
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import settings


def now_local() -> datetime:
    return datetime.now(ZoneInfo(settings.STUDIO_TIMEZONE)).replace(tzinfo=None)

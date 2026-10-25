"""
資料庫內敏感設定的加密（目前用於健身房 LINE 官方帳號的 channel secret／access token）。
Fernet（AES-128-CBC＋HMAC）。金鑰來自 DATA_ENCRYPTION_KEY，留空時由 SECRET_KEY 衍生。
"""

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


@lru_cache
def _fernet(key: str, secret: str) -> Fernet:
    if key:
        return Fernet(key.encode())
    derived = hashlib.sha256(f"{secret}:data-encryption".encode()).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


def encrypt(value: str) -> str:
    return _fernet(settings.DATA_ENCRYPTION_KEY, settings.SECRET_KEY).encrypt(value.encode()).decode()


def decrypt(token: str) -> str | None:
    """解不開（金鑰換過）時回 None，由呼叫端提示重新輸入。"""
    try:
        return _fernet(settings.DATA_ENCRYPTION_KEY, settings.SECRET_KEY).decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        return None


def hint(value: str | None) -> str | None:
    """畫面只顯示末四碼。"""
    if not value:
        return None
    return f"••••{value[-4:]}"

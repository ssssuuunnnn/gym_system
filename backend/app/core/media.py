"""每家健身房各自的上傳資料夾：MEDIA_DIR/<subdomain>/<kind>/（見 ADR 0001）。"""

import os
import uuid

from app.core.config import settings
from app.core.tenant_context import current_tenant


def save_tenant_media(kind: str, data: bytes, ext: str) -> str:
    """把上傳檔存到目前租戶的資料夾，回傳 /media/... 網址。檔名為隨機 uuid，不可猜測。"""
    tenant = current_tenant.get()
    if tenant is None:
        raise RuntimeError("上傳檔案時沒有目前租戶")
    target_dir = os.path.join(settings.MEDIA_DIR, tenant.subdomain, kind)
    os.makedirs(target_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(target_dir, filename), "wb") as fh:
        fh.write(data)
    return f"/media/{tenant.subdomain}/{kind}/{filename}"

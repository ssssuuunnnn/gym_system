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


def save_private_media(kind: str, data: bytes, ext: str) -> str:
    """
    存到不公開的資料夾 PRIVATE_MEDIA_DIR/<subdomain>/<kind>/（收據等，ADR 0015）。
    回傳相對路徑（存進資料庫），讀取用 private_media_path，只能經過需要權限的 API。
    """
    tenant = current_tenant.get()
    if tenant is None:
        raise RuntimeError("上傳檔案時沒有目前租戶")
    relative = os.path.join(tenant.subdomain, kind, f"{uuid.uuid4().hex}{ext}")
    target = os.path.join(settings.PRIVATE_MEDIA_DIR, relative)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, "wb") as fh:
        fh.write(data)
    return relative


def private_media_path(relative: str) -> str | None:
    """相對路徑 → 實際檔案路徑；只接受目前租戶自己的資料夾，檔案不存在回 None。"""
    tenant = current_tenant.get()
    root = os.path.realpath(os.path.join(settings.PRIVATE_MEDIA_DIR, tenant.subdomain)) if tenant else None
    if root is None:
        return None
    path = os.path.realpath(os.path.join(settings.PRIVATE_MEDIA_DIR, relative))
    if not path.startswith(root + os.sep) or not os.path.isfile(path):
        return None
    return path

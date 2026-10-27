"""
形象網站後台 API（見 docs/adr/0003-gym-website.md）：編輯草稿、預覽、發布、下架、上傳圖片。
訪客看到的頁面由 routers/site.py 以伺服器產生 HTML。
"""

from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.media import save_tenant_media
from app.core.security import SITE_PREVIEW_EXPIRE_MINUTES, create_site_preview_token
from app.core.tenant_context import TenantInfo
from app.deps import get_db, get_tenant, require_admin
from app.models.user import User
from app.schemas.website import PreviewTokenOut, SiteContent, WebsiteImageOut, WebsiteOut, default_site_content
from app.services import website as website_service

router = APIRouter(prefix="/website", tags=["website"])

IMAGE_CONTENT_TYPES = {"image/jpeg": ".jpg", "image/png": ".png"}
IMAGE_MAX_BYTES = 5 * 1024 * 1024


def _out(site) -> WebsiteOut:
    return WebsiteOut(
        draft=SiteContent.model_validate(site.draft),
        is_published=site.published is not None,
        has_unpublished_changes=site.published != site.draft,
        published_at=site.published_at,
        published_by_name=site.published_by_name,
        updated_at=site.updated_at,
        updated_by_name=site.updated_by_name,
    )


@router.get("", response_model=WebsiteOut)
def get_website(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    site = website_service.get_or_create_website(db)
    db.commit()
    return _out(site)


@router.put("/draft", response_model=WebsiteOut)
def save_draft(
    payload: SiteContent,
    admin: User = Depends(require_admin),
    tenant: TenantInfo = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    problems = website_service.check_references(db, payload, tenant.subdomain)
    if problems:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=problems[0])
    site = website_service.get_or_create_website(db)
    site.draft = payload.model_dump(mode="json")
    website_service.touch(site, admin.username)
    db.commit()
    return _out(site)


@router.post("/publish", response_model=WebsiteOut)
def publish(
    admin: User = Depends(require_admin), tenant: TenantInfo = Depends(get_tenant), db: Session = Depends(get_db)
):
    """草稿整份上線。發布前再驗證一次（例如教練在存草稿後被刪除）。"""
    site = website_service.get_or_create_website(db)
    content = SiteContent.model_validate(site.draft)
    problems = website_service.check_references(db, content, tenant.subdomain)
    if problems:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=problems[0])
    site.published = content.model_dump(mode="json")
    site.draft = site.published
    site.published_at = datetime.utcnow()
    site.published_by_name = admin.username
    db.commit()
    return _out(site)


@router.post("/unpublish", response_model=WebsiteOut)
def unpublish(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """網站下線：首頁改回導向登入頁；草稿保留。"""
    site = website_service.get_or_create_website(db)
    site.published = None
    website_service.touch(site, admin.username)
    db.commit()
    return _out(site)


@router.post("/discard-draft", response_model=WebsiteOut)
def discard_draft(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """捨棄草稿：回到線上版本；從未發布過則回到預設內容。"""
    site = website_service.get_or_create_website(db)
    site.draft = site.published or default_site_content(website_service.company_name(db)).model_dump(mode="json")
    website_service.touch(site, admin.username)
    db.commit()
    return _out(site)


@router.post("/preview-token", response_model=PreviewTokenOut)
def preview_token(_: User = Depends(require_admin), tenant: TenantInfo = Depends(get_tenant)):
    """後台預覽 iframe 用：/site/preview?token=…（只看得到這家的草稿）。"""
    return PreviewTokenOut(
        token=create_site_preview_token(tenant_id=tenant.id), expires_in=SITE_PREVIEW_EXPIRE_MINUTES * 60
    )


@router.post("/upload-image", response_model=WebsiteImageOut, dependencies=[Depends(require_admin)])
async def upload_image(file: UploadFile = File(...)):
    """主視覺、環境照片、分享預覽圖：jpg／png，5MB 以內。存到 MEDIA_DIR/<子網域>/site/。"""
    ext = IMAGE_CONTENT_TYPES.get(file.content_type or "")
    if ext is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="僅支援 jpg、png 格式")
    data = await file.read()
    if len(data) > IMAGE_MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="檔案超過 5MB，請壓縮後再上傳")
    return WebsiteImageOut(url=save_tenant_media("site", data, ext))

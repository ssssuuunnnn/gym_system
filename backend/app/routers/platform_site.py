"""
平台形象頁與自助申請試用（見 docs/adr/0013-trial-signup.md、R53–R56）。

只在平台網址 <PLATFORM_SUBDOMAIN>.<BASE_DOMAIN> 提供：
- `/`（由 routers/site.home 轉來）：產品介紹、適用對象、功能、常見問題、申請表單、聯絡方式
- `POST /site/signup`：申請試用；成功就開通店家（試用 30 天）＋主要管理者＋範例資料，303 到完成頁
- `/site/signup/done`：完成頁（店家網址、登入網址、試用到期日）
- `/site/terms`：服務條款與個人資料蒐集告知
後端產生頁面、不靠 JavaScript（店家網址的即時檢查是加分，沒有 JS 也能送出）。
"""

from datetime import datetime, timedelta, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo

import segno
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import session as db_session
from app.deps import clear_tenant_cache, subdomain_from_host
from app.models.tenant import Tenant
from app.services import trial as trial_service

router = APIRouter(tags=["platform-site"], include_in_schema=False)


def is_platform_host(request: Request) -> bool:
    return subdomain_from_host(request.headers.get("host", "")) == settings.PLATFORM_SUBDOMAIN


def _require_platform(request: Request) -> None:
    if not is_platform_host(request):
        raise HTTPException(status_code=404, detail="Not Found")


def _templates():
    from app.routers.site import templates  # 共用同一個 Jinja 環境（autoescape）

    return templates


def _html(body: str, status_code: int = 200) -> HTMLResponse:
    return HTMLResponse(body, status_code=status_code, headers={"Cache-Control": "no-store"})


def _base_url(request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto", request.url.scheme).split(",")[0].strip()
    return f"{proto}://{request.headers.get('host', request.url.netloc)}"


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


def _local_date(value: datetime | None) -> str:
    if value is None:
        return ""
    local = value.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(settings.STUDIO_TIMEZONE))
    return f"{local.year}/{local.month}/{local.day}"


@lru_cache(maxsize=8)
def _qr_svg(url: str) -> str:
    """加 LINE 好友網址的 QR Code（行內 SVG，電腦版用手機掃）。只由網址產生，不含其他文字。"""
    return segno.make(url, error="m").svg_inline(scale=4, border=0, dark="#0a0a0a", omitsize=True)


def _context(request: Request, db: Session) -> dict:
    row = trial_service.get_platform_settings(db)
    contact = trial_service.public_contact(db)
    return {
        "brand": row.brand_name,
        "signup_enabled": row.signup_enabled,
        "contact": contact,
        # 平台 LINE 官方帳號（形象頁設定打開「顯示」才有）：頁首、首屏、申請區、聯絡區與手機浮動按鈕都會出現
        "line_qr": _qr_svg(contact.line_url) if contact.line_url else None,
        "base_domain": settings.BASE_DOMAIN,
        "trial_days": trial_service.TRIAL_DAYS,
        "canonical": f"{_base_url(request)}/",
        "year": datetime.utcnow().year,
        "honeypot": trial_service.HONEYPOT_FIELD,
    }


def render_landing(request: Request, form: trial_service.SignupForm | None = None, errors: dict | None = None,
                   status_code: int = 200) -> HTMLResponse:
    with db_session.PlatformSessionLocal() as db:
        ctx = _context(request, db)
    return _html(
        _templates().get_template("platform/landing.html").render(
            **ctx, form=form or trial_service.SignupForm(), errors=errors or {}
        ),
        status_code,
    )


@router.post("/site/signup", response_class=HTMLResponse)
async def signup(request: Request):
    _require_platform(request)
    form = trial_service.SignupForm.from_form(dict(await request.form()))
    with db_session.PlatformSessionLocal() as db:
        result = trial_service.signup(db, form, _client_ip(request))
        if result.bot:
            return RedirectResponse("/site/signup/done", status_code=303)
        if result.errors:
            db.rollback()
            form.admin_password = ""  # 不把密碼回填到頁面上
            return render_landing(request, form, result.errors, status_code=400)
        db.commit()
        tenant = result.tenant
        db.refresh(tenant)
        clear_tenant_cache()
    trial_service.seed_sample_data(tenant)
    return RedirectResponse(f"/site/signup/done?s={tenant.subdomain}", status_code=303)


@router.get("/site/signup/done", response_class=HTMLResponse)
async def signup_done(request: Request, s: str = ""):
    _require_platform(request)
    with db_session.PlatformSessionLocal() as db:
        ctx = _context(request, db)
        tenant = None
        if s:
            # 只顯示剛剛（一小時內）自助申請的店家，避免拿來查別家的資料
            tenant = (
                db.query(Tenant)
                .filter(
                    Tenant.subdomain == s.lower()[:63],
                    Tenant.signup_source == "self",
                    Tenant.created_at >= datetime.utcnow() - timedelta(hours=1),
                )
                .first()
            )
        shop = None
        if tenant is not None:
            shop = {
                "name": tenant.name,
                "url": f"{settings.PUBLIC_SCHEME}://{tenant.subdomain}.{settings.BASE_DOMAIN}",
                "login_url": trial_service.login_url(tenant.subdomain),
                "ends": _local_date(tenant.trial_ends_at),
            }
    return _html(_templates().get_template("platform/signup_done.html").render(**ctx, shop=shop))


@router.get("/site/terms", response_class=HTMLResponse)
async def terms_page(request: Request):
    _require_platform(request)
    with db_session.PlatformSessionLocal() as db:
        ctx = _context(request, db)
    return _html(_templates().get_template("platform/terms.html").render(**ctx))

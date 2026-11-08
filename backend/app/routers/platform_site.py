"""
平台形象頁與自助申請試用（見 docs/adr/0013-trial-signup.md、R53–R56）。

只在「形象頁網址」提供（ADR 0017）：LANDING_ON_APEX 開啟時是主網域 <BASE_DOMAIN>（正式環境），
否則是平台網址 <PLATFORM_SUBDOMAIN>.<BASE_DOMAIN>（本機開發）。搬到主網域後，平台網址的這些頁面一律 301 轉過去。
- `/`（由 routers/site.home 轉來）：產品介紹、適用對象、功能、常見問題、申請表單、聯絡方式
- `/site/check-subdomain`：申請表單的店家網址即時檢查（同網址呼叫，不需要跨網域）
- `POST /site/signup`：申請試用；成功就開通店家（試用 30 天）＋主要管理者＋範例資料，303 到完成頁
- `/site/signup/done`：完成頁（店家網址、登入網址、試用到期日）
- `/site/terms`：服務條款與個人資料蒐集告知
後端產生頁面、不靠 JavaScript（店家網址的即時檢查是加分，沒有 JS 也能送出）。
"""

import json
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo

import segno
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import session as db_session
from app.deps import clear_tenant_cache, subdomain_from_host
from app.models.tenant import Tenant
from app.schemas.platform import SubdomainCheck
from app.services import tenants as tenant_service
from app.services import trial as trial_service

router = APIRouter(tags=["platform-site"], include_in_schema=False)


def is_platform_host(request: Request) -> bool:
    return subdomain_from_host(request.headers.get("host", "")) == settings.PLATFORM_SUBDOMAIN


def is_apex_host(request: Request) -> bool:
    """主網域本身（bookdex.cc），不含任何子網域。"""
    hostname = request.headers.get("host", "").split(":")[0].strip().lower().rstrip(".")
    return bool(hostname) and hostname == settings.BASE_DOMAIN.lower().strip(".")


def is_landing_host(request: Request) -> bool:
    """這個網址是不是平台形象頁所在的網址（主網域或平台網址，見 LANDING_ON_APEX）。"""
    return is_apex_host(request) if settings.LANDING_ON_APEX else is_platform_host(request)


def landing_origin() -> str:
    """形象頁搬到主網域後的正式網址，例如 https://bookdex.cc。"""
    return f"{settings.PUBLIC_SCHEME}://{settings.BASE_DOMAIN}"


def moved_landing(request: Request, status_code: int = 301) -> RedirectResponse | None:
    """形象頁已搬到主網域時，平台網址上的形象頁網址轉過去（保留路徑與查詢字串）；其他情況回 None。"""
    if not (settings.LANDING_ON_APEX and is_platform_host(request)):
        return None
    target = landing_origin() + request.url.path
    if request.url.query:
        target += "?" + request.url.query
    return RedirectResponse(target, status_code=status_code)


def _landing_only(request: Request, status_code: int = 301) -> RedirectResponse | None:
    """形象頁的路由：平台網址（已搬家）→ 轉址；不是形象頁網址 → 404；形象頁網址 → None（照常處理）。"""
    moved = moved_landing(request, status_code)
    if moved is not None:
        return moved
    if not is_landing_host(request):
        raise HTTPException(status_code=404, detail="Not Found")
    return None


def _templates():
    from app.routers.site import templates  # 共用同一個 Jinja 環境（autoescape）

    return templates


def _html(body: str, status_code: int = 200, cacheable: bool = False) -> HTMLResponse:
    # 沒有表單內容的形象頁可以快取 5 分鐘（瀏覽器與 Cloudflare 快取規則）；有錯誤訊息或個別資料的頁面不快取
    cache = "public, max-age=300" if cacheable else "no-store"
    return HTMLResponse(body, status_code=status_code, headers={"Cache-Control": cache})


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


DESCRIPTION = (
    "給健身工作室、瑜珈教室、美容美體店的線上預約與會員管理系統：預約審核、堂數方案、LINE 會員入口與通知、"
    "形象網站、優惠券、收支報表。免費試用 {days} 天，填完資料馬上開通。"
)

# 常見問題：形象頁的 FAQ 區塊與結構化資料（FAQPage）共用同一份，避免兩邊不一致
FAQS = (
    ("試用需要付費或綁信用卡嗎？", "不需要。試用 {days} 天內所有功能都能使用，不會自動扣款。"),
    (
        "試用到期後會怎樣？",
        "到期後後台與會員預約會暫停，形象網站也會暫停顯示；資料保留 60 天，期間聯絡我們轉為正式即可繼續使用，資料都還在。",
    ),
    ("開通後裡面是空的嗎？", "會先放好範例的服務人員、方案與網站草稿，讓你馬上看得到效果；不需要時可在後台一鍵清除。"),
    ("可以用自己的網址嗎？", "目前每家店使用「你的網址.{domain}」；自訂網域將於之後開放。"),
    ("會員要下載 App 嗎？", "不用。會員用手機瀏覽器或 LINE 就能預約、查看方案與預約紀錄。"),
)


def faqs() -> list[dict]:
    fmt = {"days": trial_service.TRIAL_DAYS, "domain": settings.BASE_DOMAIN}
    return [{"q": q, "a": a.format(**fmt)} for q, a in FAQS]


def _structured_data(ctx: dict) -> str:
    """形象頁的 JSON-LD：組織、網站、軟體產品（含免費試用）與常見問題。"""
    base = ctx["origin"]
    contact = ctx["contact"]
    org: dict = {
        "@type": "Organization",
        "@id": f"{base}/#organization",
        "name": ctx["brand"],
        "url": f"{base}/",
        "logo": f"{base}/site/static/brand/icon-512.png",
    }
    if contact.email:
        org["email"] = contact.email
    if contact.phone:
        org["telephone"] = contact.phone
    if contact.line_url:
        org["sameAs"] = [contact.line_url]
    graph = [
        org,
        {
            "@type": "WebSite",
            "@id": f"{base}/#website",
            "name": ctx["brand"],
            "url": f"{base}/",
            "inLanguage": "zh-Hant-TW",
            "publisher": {"@id": f"{base}/#organization"},
        },
        {
            "@type": "SoftwareApplication",
            "name": ctx["brand"],
            "url": f"{base}/",
            "description": ctx["description"],
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web",
            "inLanguage": "zh-Hant-TW",
            "image": ctx["og_image"],
            "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "TWD",
                "description": f"免費試用 {ctx['trial_days']} 天，不需信用卡",
            },
            "publisher": {"@id": f"{base}/#organization"},
        },
        {
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}}
                for f in ctx["faqs"]
            ],
        },
    ]
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace("</", "<\\/")


def landing_lastmod() -> date:
    """sitemap 的 lastmod：形象頁設定最後修改日（品牌、聯絡方式都在這裡）。"""
    with db_session.PlatformSessionLocal() as db:
        return trial_service.get_platform_settings(db).updated_at.date()


def _context(request: Request, db: Session) -> dict:
    row = trial_service.get_platform_settings(db)
    contact = trial_service.public_contact(db)
    origin = _base_url(request)
    return {
        "brand": row.brand_name,
        "signup_enabled": row.signup_enabled,
        "contact": contact,
        # 平台 LINE 官方帳號（形象頁設定打開「顯示」才有）：頁首、首屏、申請區、聯絡區與手機浮動按鈕都會出現
        "line_qr": _qr_svg(contact.line_url) if contact.line_url else None,
        "base_domain": settings.BASE_DOMAIN,
        "trial_days": trial_service.TRIAL_DAYS,
        "origin": origin,
        "canonical": f"{origin}/",
        "description": DESCRIPTION.format(days=trial_service.TRIAL_DAYS),
        "og_image": f"{origin}/site/static/brand/og-image.png",
        "faqs": faqs(),
        "year": datetime.utcnow().year,
        "honeypot": trial_service.HONEYPOT_FIELD,
    }


def render_landing(request: Request, form: trial_service.SignupForm | None = None, errors: dict | None = None,
                   status_code: int = 200) -> HTMLResponse:
    with db_session.PlatformSessionLocal() as db:
        ctx = _context(request, db)
    ctx["json_ld"] = _structured_data(ctx)
    return _html(
        _templates().get_template("platform/landing.html").render(
            **ctx, form=form or trial_service.SignupForm(), errors=errors or {}
        ),
        status_code,
        cacheable=form is None and not errors and status_code == 200,
    )


@router.post("/site/signup", response_class=HTMLResponse)
async def signup(request: Request):
    # 307 保留 POST：舊的平台網址頁面送出的申請照樣能到主網域
    if (moved := _landing_only(request, status_code=307)) is not None:
        return moved
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
    if (moved := _landing_only(request)) is not None:
        return moved
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
    if (moved := _landing_only(request)) is not None:
        return moved
    with db_session.PlatformSessionLocal() as db:
        ctx = _context(request, db)
    return _html(_templates().get_template("platform/terms.html").render(**ctx))


@router.get("/site/check-subdomain", response_model=SubdomainCheck)
async def check_subdomain(request: Request, subdomain: str = ""):
    """申請表單的店家網址即時檢查（不需登入；只回答能不能用）。放在形象頁網址上，主網域也能同網址呼叫。"""
    if (moved := _landing_only(request)) is not None:
        return moved
    with db_session.PlatformSessionLocal() as db:
        sub = tenant_service.normalize_subdomain(subdomain)[:63]
        problem = tenant_service.subdomain_problem(db, sub)
    return SubdomainCheck(subdomain=sub, available=problem is None, reason=problem)

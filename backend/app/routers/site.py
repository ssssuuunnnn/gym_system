"""
形象網站（見 docs/adr/0003-gym-website.md）：由伺服器產生整頁 HTML，訪客不需登入。

- GET  /                 依子網域顯示該家「已發布」的網站；未發布導向 /login（原本的行為）
- GET  /site/preview     後台預覽草稿（短效 token，noindex）
- POST /site/inquiry     「預約體驗課」表單（一般表單送出，不需 JavaScript）
- GET  /robots.txt、/sitemap.xml

只顯示明確列出的公開欄位：教練的電話、LINE、匯款帳號、鐘點費，課程的教練費，永遠不會進到樣板。
"""

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse, Response
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session

from app.core import clock
from app.core.config import settings
from app.core.security import SITE_PREVIEW_SCOPE, decode_access_token
from app.core.tenant_context import TenantInfo
from app.db import session as db_session
from app.db.session import TENANT_INFO_KEY
from app.deps import get_tenant
from app.models.coach import Coach
from app.models.inquiry import Inquiry
from app.models.product import Product, ProductCategory
from app.models.system_settings import SystemSettings
from app.models.website import Website
from app.schemas.website import BRAND_COLORS, DEFAULT_BRAND_COLOR, DEFAULT_THEME, SITE_THEMES, SiteContent
from app.services import line as line_service
from app.services.schedule import group_sessions

router = APIRouter(tags=["site"], include_in_schema=False)

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
STATIC_DIR = Path(__file__).resolve().parent.parent / "static" / "site"
templates = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=select_autoescape(["html", "xml"]))

WEEKDAY_LABEL = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"]
CATEGORY_LABEL = {
    ProductCategory.course: "團體課程",
    ProductCategory.single_course: "課程",
    ProductCategory.supply: "用品",
}
SECTION_NAV_LABEL = {
    "about": "關於我們",
    "schedule": "團體課表",
    "coaches": "教練團隊",
    "pricing": "方案價格",
    "gallery": "環境照片",
    "faq": "常見問題",
    "contact": "交通與聯絡",
}

# 體驗課表單防垃圾：同一個 IP 在 10 分鐘內最多送 3 次；隱藏欄位有值就當機器人
INQUIRY_RATE_WINDOW = timedelta(minutes=10)
INQUIRY_RATE_LIMIT = 3
HONEYPOT_FIELD = "website"


# ---------- 共用 ----------


def _html(body: str, status_code: int = 200, *, noindex: bool = False) -> HTMLResponse:
    headers = {"Cache-Control": "no-store" if noindex else "public, max-age=60"}
    if noindex:
        headers["X-Robots-Tag"] = "noindex, nofollow"
    return HTMLResponse(body, status_code=status_code, headers=headers)


def _message_page(title: str, text: str, status_code: int) -> HTMLResponse:
    return _html(
        templates.get_template("site/message.html").render(title=title, text=text),
        status_code,
        noindex=True,
    )


async def _resolve_tenant(request: Request) -> TenantInfo | HTMLResponse:
    """形象網站的錯誤也用網頁呈現（API 的 get_tenant 回 JSON）。"""
    try:
        return await get_tenant(request)
    except HTTPException as exc:
        if exc.status_code == 403:
            return _message_page("網站暫停服務", "這家健身房的網站目前暫停服務。", 403)
        return _message_page("找不到這個網站", "請確認網址是否正確。", 404)


def _tenant_db(tenant: TenantInfo) -> Session:
    db = db_session.SessionLocal()
    db.info[TENANT_INFO_KEY] = tenant.id
    return db


def _base_url(request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto", request.url.scheme).split(",")[0].strip()
    host = request.headers.get("host", request.url.netloc)
    return f"{proto}://{host}"


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


def _ip_hash(request: Request, tenant: TenantInfo) -> str:
    raw = f"{settings.SECRET_KEY}|{tenant.id}|{_client_ip(request)}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _line_url(value: str) -> str:
    return value if value.startswith("https://") else f"https://line.me/R/ti/p/{value}"


def _money(value) -> str:
    amount = float(value)
    return f"{amount:,.0f}" if amount == int(amount) else f"{amount:,.2f}"


# ---------- 組出頁面資料 ----------


@dataclass
class FormState:
    values: dict = field(default_factory=dict)
    errors: dict = field(default_factory=dict)
    sent: bool = False


def _schedule_days(db: Session, show_seats: bool) -> list[dict]:
    today = clock.now_local().date()
    sessions, _ = group_sessions(db, today, today + timedelta(days=6))
    days = []
    for offset in range(7):
        day = today + timedelta(days=offset)
        classes = []
        for gs in sessions:
            if gs.session.session_date != day:
                continue
            left = max(gs.course.max_capacity - gs.booked_count, 0)
            minute = gs.session.start_minute
            classes.append(
                {
                    "time": f"{minute // 60:02d}:{minute % 60:02d}",
                    "name": gs.course.name,
                    "coach": gs.coach.alias or gs.coach.name,
                    "minutes": gs.session.duration_minutes,
                    "seats": ("已額滿" if left == 0 else f"剩 {left} 位") if show_seats else None,
                    "full": left == 0,
                }
            )
        days.append(
            {
                "label": WEEKDAY_LABEL[day.weekday()],
                "date": f"{day.month}/{day.day}",
                "is_today": offset == 0,
                "classes": classes,
            }
        )
    return days


def _coaches(db: Session, content: SiteContent) -> list[dict]:
    """只取公開欄位：授課名稱、專長、照片，加上網站用的自我介紹。"""
    ids = [c.coach_id for c in content.coaches.items]
    rows = {c.id: c for c in db.query(Coach).filter(Coach.id.in_(ids))} if ids else {}
    result = []
    for entry in content.coaches.items:
        coach = rows.get(entry.coach_id)
        if coach is None:
            continue
        result.append(
            {
                "name": coach.alias or coach.name,
                "specialty": coach.specialty or "",
                "photo_url": coach.photo_url,
                "bio": entry.bio,
            }
        )
    return result


def _plans(db: Session, content: SiteContent) -> list[dict]:
    ids = [p.product_id for p in content.pricing.items]
    rows = (
        {p.id: p for p in db.query(Product).filter(Product.id.in_(ids), Product.is_active.is_(True))} if ids else {}
    )
    result = []
    for entry in content.pricing.items:
        product = rows.get(entry.product_id)
        if product is None:
            continue
        result.append(
            {
                "kind": CATEGORY_LABEL.get(product.category, ""),
                "name": product.name,
                "price": _money(product.price),
                "hours": product.session_hours if product.category != ProductCategory.supply else None,
                "description": entry.description,
            }
        )
    return result


def render_site(
    request: Request,
    db: Session,
    tenant: TenantInfo,
    content: SiteContent,
    *,
    preview: bool = False,
    form: FormState | None = None,
) -> str:
    company = db.query(SystemSettings).first()
    company_name = (company.short_name or company.company_name) if company else tenant.subdomain
    full_name = company.company_name if company else company_name
    base = _base_url(request)
    brand = BRAND_COLORS.get(content.brand_color) or BRAND_COLORS[DEFAULT_BRAND_COLOR]
    accent = content.brand_color if content.brand_color in BRAND_COLORS else DEFAULT_BRAND_COLOR

    visible = [s.key for s in content.sections if s.visible]
    data = {
        "schedule_days": _schedule_days(db, content.schedule.show_seats) if "schedule" in visible else [],
        "coaches": _coaches(db, content) if "coaches" in visible else [],
        "plans": _plans(db, content) if "pricing" in visible else [],
    }
    has_content = {
        "hero": True,
        "about": bool(content.about.text or content.about.features),
        "schedule": any(d["classes"] for d in data["schedule_days"]),
        "coaches": bool(data["coaches"]),
        "pricing": bool(data["plans"]),
        "gallery": bool(content.gallery.images),
        "faq": bool(content.faq.items),
        "trial": True,
        "contact": True,
    }
    sections = [key for key in visible if has_content[key]]

    def absolute(url: str | None) -> str | None:
        return f"{base}{url}" if url else None

    og_image = absolute(content.seo.og_image_url or content.hero.image_url or (company.logo_url if company else None))
    title = content.seo.title or full_name
    description = content.seo.description or content.hero.description or ""
    contact = content.contact
    json_ld = {
        "@context": "https://schema.org",
        "@type": "ExerciseGym",
        "name": full_name,
        "url": f"{base}/",
    }
    if contact.address:
        json_ld["address"] = contact.address
    if contact.phone:
        json_ld["telephone"] = contact.phone
    if og_image:
        json_ld["image"] = og_image
    same_as = [
        url
        for url in (
            f"https://www.instagram.com/{contact.instagram}/" if contact.instagram else None,
            contact.facebook or None,
        )
        if url
    ]
    if same_as:
        json_ld["sameAs"] = same_as

    theme = content.theme if content.theme in SITE_THEMES else DEFAULT_THEME
    return templates.get_template("site/bold.html").render(
        c=content,
        theme=theme,
        theme_color=SITE_THEMES[theme]["theme_color"],
        theme_fonts=SITE_THEMES[theme]["fonts"],
        company_name=company_name,
        full_name=full_name,
        logo_url=company.logo_url if company else None,
        accent=accent,
        accent_light=brand["light"],
        sections=sections,
        nav=[(key, SECTION_NAV_LABEL[key]) for key in sections if key in SECTION_NAV_LABEL],
        title=title,
        description=description,
        canonical=f"{base}/",
        og_image=og_image,
        # </script> 不能出現在內嵌 JSON 裡
        json_ld=json.dumps(json_ld, ensure_ascii=False).replace("</", "<\\/"),
        line_url=_line_url(contact.line) if contact.line else None,
        instagram_url=f"https://www.instagram.com/{contact.instagram}/" if contact.instagram else None,
        facebook_url=contact.facebook or None,
        preview=preview,
        form=form or FormState(),
        honeypot=HONEYPOT_FIELD,
        year=clock.now_local().year,
        **data,
    )


def _published(db: Session) -> SiteContent | None:
    site = db.query(Website).first()
    return SiteContent.model_validate(site.published) if site and site.published else None


# ---------- 路由 ----------


@router.get("/", response_class=HTMLResponse)
async def home(request: Request, sent: int | None = None):
    tenant = await _resolve_tenant(request)
    if isinstance(tenant, HTMLResponse):
        return tenant
    with _tenant_db(tenant) as db:
        content = _published(db)
        if content is None:
            return RedirectResponse("/login", status_code=302)
        form = FormState(sent=bool(sent))
        return _html(render_site(request, db, tenant, content, form=form))


@router.get("/site/preview", response_class=HTMLResponse)
async def preview(request: Request, token: str = ""):
    tenant = await _resolve_tenant(request)
    if isinstance(tenant, HTMLResponse):
        return tenant
    payload = decode_access_token(token) if token else None
    if not payload or payload.get("scope") != SITE_PREVIEW_SCOPE or payload.get("tid") != tenant.id:
        return _message_page("預覽連結已失效", "請回到後台重新開啟預覽。", 403)
    with _tenant_db(tenant) as db:
        site = db.query(Website).first()
        if site is None:
            return _message_page("尚未建立網站", "請先在後台編輯形象網站。", 404)
        content = SiteContent.model_validate(site.draft)
        return _html(render_site(request, db, tenant, content, preview=True), noindex=True)


def _validate_inquiry(form: dict, content: SiteContent) -> tuple[dict, dict]:
    values = {k: (form.get(k) or "").strip() for k in ("name", "phone", "line_id", "interest", "slot", "message")}
    errors = {}
    if not values["name"]:
        errors["name"] = "請輸入姓名"
    elif len(values["name"]) > 50:
        errors["name"] = "姓名最多 50 字"
    digits = [ch for ch in values["phone"] if ch.isdigit()]
    if not values["phone"]:
        errors["phone"] = "請輸入手機號碼"
    elif len(values["phone"]) > 30 or len(digits) < 8 or any(ch not in "0123456789+-() " for ch in values["phone"]):
        errors["phone"] = "手機號碼格式不正確"
    if len(values["line_id"]) > 50:
        errors["line_id"] = "LINE ID 最多 50 字"
    if values["interest"] and values["interest"] not in content.trial.interests:
        errors["interest"] = "請重新選擇"
    if values["slot"] and values["slot"] not in content.trial.slots:
        errors["slot"] = "請重新選擇"
    if len(values["message"]) > 500:
        errors["message"] = "最多 500 字"
    if form.get("consent") != "on":
        errors["consent"] = "請勾選同意個人資料蒐集告知事項"
    return values, errors


@router.post("/site/inquiry", response_class=HTMLResponse)
async def submit_inquiry(request: Request, background_tasks: BackgroundTasks):
    tenant = await _resolve_tenant(request)
    if isinstance(tenant, HTMLResponse):
        return tenant
    form = dict(await request.form())
    with _tenant_db(tenant) as db:
        content = _published(db)
        if content is None or not any(s.key == "trial" and s.visible for s in content.sections):
            return _message_page("找不到這個頁面", "這家健身房目前沒有開放線上預約體驗課。", 404)

        # 機器人填了隱藏欄位：假裝成功，不存資料
        if form.get(HONEYPOT_FIELD):
            return RedirectResponse("/?sent=1#trial", status_code=303)

        values, errors = _validate_inquiry(form, content)
        ip_hash = _ip_hash(request, tenant)
        if not errors:
            recent = (
                db.query(Inquiry)
                .filter(Inquiry.ip_hash == ip_hash, Inquiry.created_at >= datetime.utcnow() - INQUIRY_RATE_WINDOW)
                .count()
            )
            if recent >= INQUIRY_RATE_LIMIT:
                errors["form"] = "送出次數太多，請稍後再試，或直接用電話、LINE 與我們聯絡。"
        if errors:
            state = FormState(values=values, errors=errors)
            return _html(render_site(request, db, tenant, content, form=state), 400, noindex=True)

        inquiry = Inquiry(
            name=values["name"],
            phone=values["phone"],
            line_id=values["line_id"] or None,
            interest=values["interest"] or None,
            preferred_slot=values["slot"] or None,
            message=values["message"] or None,
            consent_at=datetime.utcnow(),
            ip_hash=ip_hash,
        )
        db.add(inquiry)
        db.flush()
        # LINE 通知店家：新的體驗課詢問（只有姓氏，不含手機；docs/adr/0004-line-notifications.md）
        notification_id = line_service.notify_inquiry(db, inquiry)
        db.commit()
    line_service.schedule(background_tasks, notification_id)
    # 送出後導回首頁（避免重新整理時重送）
    return RedirectResponse("/?sent=1#trial", status_code=303)


@router.get("/robots.txt", response_class=PlainTextResponse)
async def robots(request: Request):
    tenant = await _resolve_tenant(request)
    if isinstance(tenant, HTMLResponse):
        return PlainTextResponse("User-agent: *\nDisallow: /\n")
    with _tenant_db(tenant) as db:
        if _published(db) is None:
            return PlainTextResponse("User-agent: *\nDisallow: /\n")
    base = _base_url(request)
    return PlainTextResponse(
        "User-agent: *\nAllow: /$\nAllow: /site/static/\nAllow: /media/\nDisallow: /\n"
        f"Sitemap: {base}/sitemap.xml\n"
    )


@router.get("/sitemap.xml")
async def sitemap(request: Request):
    tenant = await _resolve_tenant(request)
    if isinstance(tenant, HTMLResponse):
        return tenant
    with _tenant_db(tenant) as db:
        site = db.query(Website).first()
        if site is None or site.published is None:
            return Response(status_code=404)
        lastmod = (site.published_at or site.updated_at).date().isoformat()
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"  <url><loc>{_base_url(request)}/</loc><lastmod>{lastmod}</lastmod></url>\n"
        "</urlset>\n"
    )
    return Response(body, media_type="application/xml")

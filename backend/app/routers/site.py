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
from app.models.news import NewsPost
from app.models.product import Product, ProductCategory
from app.models.system_settings import SystemSettings
from app.models.website import Website
from app.schemas.website import BRAND_COLORS, DEFAULT_BRAND_COLOR, DEFAULT_THEME, SITE_THEMES, SiteContent
from app.services import line as line_service
from app.services import terms
from app.services import staff_notifications
from app.services.schedule import group_sessions
from app.services.shop import DEFAULT_COMPANY_NAMES, shop_names
from app.services import branches as branch_service
from app.services import news as news_service

router = APIRouter(tags=["site"], include_in_schema=False)

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
STATIC_DIR = Path(__file__).resolve().parent.parent / "static" / "site"
templates = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=select_autoescape(["html", "xml"]))

WEEKDAY_LABEL = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"]
def category_label(category: ProductCategory) -> str:
    """方案分類的顯示文字依行業（ADR 0011）：課程→療程、用品→商品。"""
    return {
        ProductCategory.course: "團體課程",
        ProductCategory.single_course: terms.t("product_course"),
        ProductCategory.supply: terms.t("product_supply"),
    }.get(category, "")


def section_nav_label(key: str) -> str | None:
    return {
        "about": "關於我們",
        "schedule": "團體課表",
        "coaches": f"{terms.t('staff')}團隊",
        "pricing": "方案價格",
        "gallery": "環境照片",
        "faq": "常見問題",
        "news": "最新消息",
        "contact": "交通與聯絡",
    }.get(key)

# 體驗課表單防垃圾：同一個 IP 在 10 分鐘內最多送 3 次；隱藏欄位有值就當機器人
INQUIRY_RATE_WINDOW = timedelta(minutes=10)
INQUIRY_RATE_LIMIT = 3
HONEYPOT_FIELD = "website"


# 預設的公司名稱（含沒有系統設定時用的「健身工作室」），不當成自訂的網頁標題
PLACEHOLDER_TITLES = DEFAULT_COMPANY_NAMES | {name.replace("管理系統", "") for name in DEFAULT_COMPANY_NAMES}


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
            return _message_page("網站暫停服務", "這家店的網站目前暫停服務。", 403)
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


def _social_links(contact) -> list[dict]:
    """店家的社群平台（填了才出現），依固定順序；交通與聯絡、頁尾、結構化資料共用。"""
    links = [
        ("line", "LINE 官方帳號", _line_url(contact.line) if contact.line else None),
        ("instagram", "Instagram", f"https://www.instagram.com/{contact.instagram}/" if contact.instagram else None),
        ("facebook", "Facebook", contact.facebook or None),
        ("youtube", "YouTube", contact.youtube or None),
        ("threads", "Threads", f"https://www.threads.com/@{contact.threads}" if contact.threads else None),
        ("tiktok", "TikTok", f"https://www.tiktok.com/@{contact.tiktok}" if contact.tiktok else None),
    ]
    return [{"key": key, "label": label, "url": url} for key, label, url in links if url]


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
    multi_branch = branch_service.has_multiple(db)  # 有兩間以上分店才在課表寫分店名稱
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
                    "branch": gs.branch.name if multi_branch else None,
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
                "kind": category_label(product.category),
                "name": product.name,
                "price": _money(product.price),
                "amount": float(product.price),  # 只用來找最低價（方案起價）
                "hours": product.session_hours if product.category != ProductCategory.supply else None,
                "description": entry.description,
            }
        )
    return result


def _date_label(value: datetime | None) -> str:
    """消息日期（店家當地時間）：2026/10/31。"""
    if value is None:
        return ""
    local = clock.to_local(value)
    return f"{local.year}/{local.month}/{local.day}"


def _news_item(post: NewsPost) -> dict:
    """樣板只拿得到這些欄位（不把 ORM 物件交給樣板，R16）。"""
    return {
        "id": post.id,
        "title": post.title,
        "summary": post.summary,
        "body": post.body,
        "image_url": post.image_url,
        "date": _date_label(post.published_at),
        "iso": post.published_at.date().isoformat() if post.published_at else "",
        "path": news_service.path_of(post),
    }


def _news_items(db: Session, limit: int | None = None) -> list[dict]:
    return [_news_item(p) for p in news_service.published_posts(db, limit)]


def site_context(
    request: Request,
    db: Session,
    tenant: TenantInfo,
    content: SiteContent,
    *,
    preview: bool = False,
    form: FormState | None = None,
) -> dict:
    """形象網站樣板的共用資料（首頁與最新消息頁共用頁首、頁尾、品牌色、版型）。"""
    company = db.query(SystemSettings).first()
    # 店名：簡稱 → 公司名稱 → 平台開通時的名稱（與後台、前台分頁標題同一個來源）
    names = shop_names(db, tenant.id, company)
    company_name, full_name = names.short, names.full
    base = _base_url(request)
    brand = BRAND_COLORS.get(content.brand_color) or BRAND_COLORS[DEFAULT_BRAND_COLOR]
    accent = content.brand_color if content.brand_color in BRAND_COLORS else DEFAULT_BRAND_COLOR

    visible = [s.key for s in content.sections if s.visible]
    # 沒有開團體課程的店（美體店預設）不顯示課表（ADR 0011）
    group_on = company.group_classes_enabled if company else terms.GROUP_CLASSES_DEFAULT[tenant.business_type]
    if not group_on:
        visible = [key for key in visible if key != "schedule"]
    data = {
        "schedule_days": _schedule_days(db, content.schedule.show_seats) if "schedule" in visible else [],
        "coaches": _coaches(db, content) if "coaches" in visible else [],
        "plans": _plans(db, content) if "pricing" in visible else [],
        "news": _news_items(db, content.news.count) if "news" in visible else [],
    }
    has_content = {
        "hero": True,
        "about": bool(content.about.text or content.about.features),
        "news": bool(data["news"]),
        "schedule": any(d["classes"] for d in data["schedule_days"]),
        "coaches": bool(data["coaches"]),
        "pricing": bool(data["plans"]),
        "gallery": bool(content.gallery.images),
        "faq": bool(content.faq.items),
        "trial": True,
        "contact": True,
    }
    sections = [key for key in visible if has_content[key]]
    # 最低價的方案（方格／側欄版型的「方案起價」用；方案照後台順序排，不一定第一個最便宜）
    cheapest_plan = min(data["plans"], key=lambda p: p["amount"]) if data["plans"] else None
    # 最近的一堂團體課（方格／側欄版型的「下一堂課」用）
    next_class = None
    for offset, day in enumerate(data["schedule_days"]):
        if day["classes"]:
            when = "今天" if offset == 0 else "明天" if offset == 1 else day["label"]
            next_class = {"when": when, "date": day["date"], **day["classes"][0]}
            break

    def absolute(url: str | None) -> str | None:
        return f"{base}{url}" if url else None

    og_image = absolute(content.seo.og_image_url or content.hero.image_url or (company.logo_url if company else None))
    # 舊網站建立時會把當時的名稱（常是預設的「…管理系統」）寫進搜尋標題，這種視同沒填
    seo_title = content.seo.title.strip()
    title = full_name if not seo_title or seo_title in PLACEHOLDER_TITLES else seo_title
    if preview:
        title = f"（預覽）{title}"
    description = content.seo.description or content.hero.description or ""
    contact = content.contact
    json_ld = {
        "@context": "https://schema.org",
        "@type": "ExerciseGym" if tenant.business_type == "fitness" else "HealthAndBeautyBusiness",
        "name": full_name,
        "url": f"{base}/",
    }
    if contact.address:
        json_ld["address"] = contact.address
    if contact.phone:
        json_ld["telephone"] = contact.phone
    if og_image:
        json_ld["image"] = og_image
    socials = _social_links(contact)
    same_as = [link["url"] for link in socials if link["key"] != "line"]
    if same_as:
        json_ld["sameAs"] = same_as

    theme = content.theme if content.theme in SITE_THEMES else DEFAULT_THEME
    layout = SITE_THEMES[theme]["template"]
    return dict(
        template=f"site/{layout}.html",
        # 單篇頁面（不是用版型樣板）要另外載入的樣式：活力＝只有 site.css；清爽／溫暖＝theme-<key>.css；其他＝<版型>.css
        layout_css=None if theme == "bold" else (f"theme-{theme}.css" if layout == "bold" else f"{layout}.css"),
        # 頁首選單連到首頁的段落；首頁用 #key，其他頁用 /#key
        home="",
        next_class=next_class,
        cheapest_plan=cheapest_plan,
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
        nav=[(key, label) for key in sections if (label := section_nav_label(key))],
        t=terms.terms(tenant.business_type),
        title=title,
        description=description,
        canonical=f"{base}/",
        og_image=og_image,
        # </script> 不能出現在內嵌 JSON 裡
        json_ld=json.dumps(json_ld, ensure_ascii=False).replace("</", "<\\/"),
        line_url=_line_url(contact.line) if contact.line else None,
        socials=socials,
        preview=preview,
        form=form or FormState(),
        honeypot=HONEYPOT_FIELD,
        year=clock.now_local().year,
        **data,
    )


def render_site(
    request: Request,
    db: Session,
    tenant: TenantInfo,
    content: SiteContent,
    *,
    preview: bool = False,
    form: FormState | None = None,
) -> str:
    ctx = site_context(request, db, tenant, content, preview=preview, form=form)
    return templates.get_template(ctx.pop("template")).render(**ctx)


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


# ---------- 最新消息頁（ADR 0012） ----------


def _preview_ok(tenant: TenantInfo, token: str) -> bool:
    payload = decode_access_token(token) if token else None
    return bool(payload and payload.get("scope") == SITE_PREVIEW_SCOPE and payload.get("tid") == tenant.id)


def _news_page(request: Request, db: Session, tenant: TenantInfo, content: SiteContent, preview: bool, **page) -> str:
    """消息列表／單篇共用：沿用首頁的頁首、頁尾與版型樣式，只換主要內容與標題。"""
    ctx = site_context(request, db, tenant, content, preview=preview)
    ctx.pop("template")
    ctx["home"] = "/"
    ctx.update(page)
    full_name = ctx["full_name"]
    ctx["title"] = f"{page['page_title']}｜{full_name}"
    ctx["canonical"] = page["canonical"]
    article = page.get("article")
    if article:
        ctx["description"] = (article["summary"] or article["body"].replace("\n", " "))[:150]
        if page.get("article_image"):
            ctx["og_image"] = page["article_image"]
        json_ld = {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "headline": article["title"][:110],
            "datePublished": article["iso"],
            "publisher": {"@type": "Organization", "name": full_name},
            "mainEntityOfPage": page["canonical"],
        }
        if page.get("article_image"):
            json_ld["image"] = [page["article_image"]]
        ctx["json_ld"] = json.dumps(json_ld, ensure_ascii=False).replace("</", "<\\/")
    return templates.get_template("site/news.html").render(**ctx)


async def _news_site(request: Request, token: str):
    """回傳 (tenant, preview)；預覽時用草稿外觀、看得到未發布的消息；網站未發布又不是預覽 → None。"""
    tenant = await _resolve_tenant(request)
    if isinstance(tenant, HTMLResponse):
        return tenant, False
    return tenant, _preview_ok(tenant, token)


def _site_content(db: Session, preview: bool) -> SiteContent | None:
    site = db.query(Website).first()
    if site is None:
        return None
    if preview:
        return SiteContent.model_validate(site.draft)
    return SiteContent.model_validate(site.published) if site.published else None


@router.get("/site/news", response_class=HTMLResponse)
async def news_index(request: Request, token: str = ""):
    tenant, preview = await _news_site(request, token)
    if isinstance(tenant, HTMLResponse):
        return tenant
    with _tenant_db(tenant) as db:
        content = _site_content(db, preview)
        if content is None:
            return RedirectResponse("/login", status_code=302)
        base = _base_url(request)
        title = content.news.title
        body = _news_page(
            request, db, tenant, content, preview,
            news_list=_news_items(db), article=None,
            page_title=title,
            canonical=f"{base}{news_service.NEWS_PATH}",
        )
        return _html(body, noindex=preview)


@router.get("/site/news/{news_id}", response_class=HTMLResponse)
async def news_detail(request: Request, news_id: int, token: str = ""):
    tenant, preview = await _news_site(request, token)
    if isinstance(tenant, HTMLResponse):
        return tenant
    with _tenant_db(tenant) as db:
        content = _site_content(db, preview)
        if content is None:
            return RedirectResponse("/login", status_code=302)
        post = db.get(NewsPost, news_id)
        if post is None or not (post.is_published or preview):
            return _message_page("找不到這則消息", "這則消息可能已經下架，請回到網站首頁看看其他消息。", 404)
        base = _base_url(request)
        article = _news_item(post)
        image = f"{base}{post.image_url}" if post.image_url else None
        body = _news_page(
            request, db, tenant, content, preview,
            news_list=None, article=article,
            page_title=post.title,
            canonical=f"{base}{article['path']}",
            article_image=image,
        )
        return _html(body, noindex=preview or not post.is_published)


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
            return _message_page("找不到這個頁面", f"這家店目前沒有開放線上預約{terms.t('trial')}。", 404)

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
        # 後台鈴鐺通知（ADR 0009）
        staff_notifications.notify_inquiry(db, inquiry)
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
        "User-agent: *\nAllow: /$\nAllow: /site/static/\nAllow: /site/news\nAllow: /media/\nDisallow: /\n"
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
        posts = news_service.published_posts(db)
        news_urls = [(news_service.path_of(p), p.updated_at.date().isoformat()) for p in posts]
    base = _base_url(request)
    urls = [("/", lastmod)]
    if news_urls:
        urls.append((news_service.NEWS_PATH, max(d for _, d in news_urls)))
        urls += news_urls
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{base}{path}</loc><lastmod>{day}</lastmod></url>\n" for path, day in urls)
        + "</urlset>\n"
    )
    return Response(body, media_type="application/xml")

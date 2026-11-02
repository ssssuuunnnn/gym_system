"""
平台形象頁的自助試用（見 docs/adr/0013-trial-signup.md、R53–R56）。

- signup()：在平台帳號的交易裡檢查、開通店家（試用 30 天）、建立主要管理者、寫申請紀錄與操作紀錄。
- seed_sample_data()：開通後以該店的應用程式帳號（受 RLS）建立範例資料，id 記在 system_settings.sample_data。
- clear_sample_data()：店家後台「清除範例資料」；已經被預約或購買用到的不刪，改成下架。
"""

import hashlib
import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import unusable_password
from app.core.tenant_context import TenantInfo, current_tenant
from app.db import session as db_session
from app.models.coach import Coach
from app.models.course import (
    Course,
    CourseSession,
    CourseStatus,
    CourseWeekday,
    ScheduleEndMode,
    SessionSource,
)
from app.models.platform import PlatformSettings, TrialSignup
from app.models.product import Product, ProductCategory
from app.models.purchase import Purchase
from app.models.reservation import Reservation
from app.models.system_settings import SystemSettings
from app.models.tenant import BusinessType, Tenant, TenantStatus, trial_expired
from app.models.user import User, UserRole
from app.models.website import Website
from app.schemas.website import SiteContent
from app.services import tenants as tenant_service

logger = logging.getLogger(__name__)

TRIAL_DAYS = 30
# 同一個 IP 一天最多申請幾次
SIGNUP_IP_LIMIT = 3
SIGNUP_IP_WINDOW = timedelta(days=1)
HONEYPOT_FIELD = "website"
PHONE_RE = re.compile(r"^\+?\d{8,15}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,30}$")


# ---------- 平台設定 ----------


def get_platform_settings(db: Session) -> PlatformSettings:
    row = db.query(PlatformSettings).order_by(PlatformSettings.id).first()
    if row is None:  # migration 已建立一筆；保險起見
        row = PlatformSettings(id=1)
        db.add(row)
        db.flush()
    return row


@dataclass
class PublicContact:
    brand_name: str
    email: str | None = None
    line: str | None = None
    phone: str | None = None

    @property
    def line_url(self) -> str | None:
        if not self.line:
            return None
        return self.line if self.line.startswith("https://") else f"https://line.me/R/ti/p/{self.line}"

    @property
    def any(self) -> bool:
        return bool(self.email or self.line or self.phone)


def public_contact(db: Session) -> PublicContact:
    """形象頁與店家的「試用已到期」頁顯示的聯絡方式（只有設定為顯示的）。店家網址也讀得到（SECURITY DEFINER 函式）。"""
    row = db.execute(text("SELECT * FROM platform_public_contact()")).mappings().first()
    if row is None:
        return PublicContact(brand_name="店家預約管理系統")
    return PublicContact(brand_name=row["brand_name"], email=row["email"], line=row["line"], phone=row["phone"])


# ---------- 試用狀態 ----------


def days_left(tenant_status: TenantStatus, ends_at: datetime | None, now: datetime | None = None) -> int | None:
    """試用剩幾天（無條件進位，到期當天之後為 0）；不是試用或不限期時為 None。"""
    if tenant_status != TenantStatus.trial or ends_at is None:
        return None
    seconds = (ends_at - (now or datetime.utcnow())).total_seconds()
    return max(0, -int(-seconds // 86400))


def running_tenant_ids(db: Session) -> list[int]:
    """背景工作要處理的店家：試用已到期的不處理（不發 LINE 提醒等，R55）。"""
    now = datetime.utcnow()
    return [
        tid
        for (tid,) in db.query(Tenant.id)
        .filter(or_(Tenant.status != TenantStatus.trial, Tenant.trial_ends_at.is_(None), Tenant.trial_ends_at > now))
        .order_by(Tenant.id)
    ]


# ---------- 自助申請 ----------


@dataclass
class SignupForm:
    store_name: str = ""
    business_type: str = "fitness"
    subdomain: str = ""
    contact_name: str = ""
    phone: str = ""
    email: str = ""
    admin_username: str = ""
    admin_password: str = ""
    consent: bool = False
    honeypot: str = ""

    @classmethod
    def from_form(cls, form: dict) -> "SignupForm":
        get = lambda k: (form.get(k) or "").strip()  # noqa: E731
        return cls(
            store_name=get("store_name"),
            business_type=get("business_type") or "fitness",
            subdomain=get("subdomain").lower(),
            contact_name=get("contact_name"),
            phone=get("phone"),
            email=get("email").lower(),
            admin_username=get("admin_username"),
            admin_password=form.get("admin_password") or "",
            consent=form.get("consent") == "on",
            honeypot=get(HONEYPOT_FIELD),
        )


@dataclass
class SignupResult:
    tenant: Tenant | None = None
    errors: dict[str, str] = field(default_factory=dict)
    # 機器人（填了隱藏欄位）：假裝成功、不建立任何東西
    bot: bool = False


def ip_hash(ip: str) -> str:
    return hashlib.sha256(f"{settings.SECRET_KEY}|signup|{ip}".encode()).hexdigest()


def normalize_phone(value: str) -> str:
    return re.sub(r"[\s\-()]", "", value)


def _validate(db: Session, f: SignupForm) -> dict[str, str]:
    errors: dict[str, str] = {}
    if not f.store_name:
        errors["store_name"] = "請輸入店名"
    elif len(f.store_name) > 100:
        errors["store_name"] = "店名最多 100 字"
    if f.business_type not in BusinessType.__members__:
        errors["business_type"] = "請選擇行業類型"
    problem = tenant_service.subdomain_problem(db, f.subdomain) if f.subdomain else "請輸入店家網址"
    if problem:
        errors["subdomain"] = problem
    if not f.contact_name:
        errors["contact_name"] = "請輸入聯絡人姓名"
    elif len(f.contact_name) > 100:
        errors["contact_name"] = "姓名最多 100 字"
    phone = normalize_phone(f.phone)
    if not phone:
        errors["phone"] = "請輸入手機號碼"
    elif not PHONE_RE.match(phone):
        errors["phone"] = "手機號碼格式不正確"
    if not f.email:
        errors["email"] = "請輸入 Email"
    elif len(f.email) > 255 or not EMAIL_RE.match(f.email):
        errors["email"] = "Email 格式不正確"
    if not USERNAME_RE.match(f.admin_username):
        errors["admin_username"] = "帳號請用 3–30 個英文、數字或 . _ -"
    if len(f.admin_password) < tenant_service.MIN_PASSWORD_LENGTH:
        errors["admin_password"] = f"密碼至少 {tenant_service.MIN_PASSWORD_LENGTH} 碼"
    if not f.consent:
        errors["consent"] = "請勾選同意服務條款與個人資料蒐集告知"
    # 同一支手機、同一個 Email 只能試用一次（R54）
    if "phone" not in errors and db.query(TrialSignup.id).filter(TrialSignup.phone == phone).first():
        errors["phone"] = "這支手機已經申請過試用，請聯絡我們協助"
    if "email" not in errors and db.query(TrialSignup.id).filter(TrialSignup.email == f.email).first():
        errors["email"] = "這個 Email 已經申請過試用，請聯絡我們協助"
    return errors


def signup(db: Session, f: SignupForm, client_ip: str) -> SignupResult:
    """
    自助申請試用（平台帳號的 Session；呼叫端 commit）。成功時已建立：店家（試用 30 天、signup_source=self）、
    主要管理者、申請紀錄、操作紀錄。範例資料在 commit 之後另外用 seed_sample_data() 建立。
    """
    if f.honeypot:
        return SignupResult(bot=True)
    if not get_platform_settings(db).signup_enabled:
        return SignupResult(errors={"form": "目前暫停開放線上申請試用，請聯絡我們"})
    hashed = ip_hash(client_ip)
    recent = (
        db.query(func.count(TrialSignup.id))
        .filter(TrialSignup.ip_hash == hashed, TrialSignup.created_at >= datetime.utcnow() - SIGNUP_IP_WINDOW)
        .scalar()
    )
    if recent >= SIGNUP_IP_LIMIT:
        return SignupResult(errors={"form": "今天的申請次數已達上限，請明天再試，或聯絡我們協助"})
    errors = _validate(db, f)
    if errors:
        return SignupResult(errors=errors)

    phone = normalize_phone(f.phone)
    try:
        tenant = tenant_service.create_tenant(
            db,
            subdomain=f.subdomain,
            name=f.store_name,
            status=TenantStatus.trial,
            business_type=BusinessType[f.business_type],
            contact_name=f.contact_name,
            contact_email=f.email,
            contact_phone=phone,
        )
        tenant.trial_ends_at = datetime.utcnow() + timedelta(days=TRIAL_DAYS)
        tenant.signup_source = "self"
        admin = tenant_service.create_tenant_admin(db, tenant.id, f.admin_username, f.admin_password)
        admin.display_name = f.contact_name
    except tenant_service.TenantError as exc:
        db.rollback()
        return SignupResult(errors={"form": str(exc)})
    db.add(
        TrialSignup(
            tenant_id=tenant.id,
            store_name=f.store_name,
            contact_name=f.contact_name,
            phone=phone,
            email=f.email,
            ip_hash=hashed,
        )
    )
    tenant_service.audit(
        db,
        action="self_signup",
        admin_id=None,
        admin_username="形象頁自助申請",
        tenant_id=tenant.id,
        detail={
            "subdomain": tenant.subdomain,
            "name": tenant.name,
            "business_type": tenant.business_type.value,
            "admin_username": admin.username,
            "trial_days": TRIAL_DAYS,
        },
    )
    db.flush()
    return SignupResult(tenant=tenant)


# ---------- 範例資料 ----------

SAMPLE = {
    "fitness": {
        "staff": [
            {"name": "Alex 教練", "specialty": "肌力訓練、減脂、體態雕塑", "group": True,
             "bio": "十年肌力訓練經驗，擅長幫初學者建立正確動作。"},
            {"name": "Mia 教練", "specialty": "瑜伽、伸展、核心訓練", "group": False,
             "bio": "溫柔細心，適合想改善肩頸痠痛、提升柔軟度的你。"},
        ],
        "products": [
            {"name": "單堂體驗課", "category": "single_course", "hours": 1, "price": 600,
             "description": "第一次來的你，先體驗看看"},
            {"name": "私人課 10 堂", "category": "single_course", "hours": 10, "price": 12000,
             "description": "一對一指導，可指定教練"},
            {"name": "運動毛巾", "category": "supply", "stock": 20, "price": 350},
        ],
        "course": {"name": "晚間燃脂團課", "weekdays": [2, 4], "hour": 19, "weeks": 8, "capacity": 12,
                   "product": "燃脂團課 8 週方案", "price": 4800,
                   "description": "高強度間歇訓練，跟著音樂一起流汗。"},
    },
    "beauty": {
        "staff": [
            {"name": "Amy 美容師", "specialty": "臉部保養、深層清潔", "group": False,
             "bio": "專注肌膚保養八年，依你的膚況調整療程。"},
            {"name": "Lily 美容師", "specialty": "全身舒壓、肩頸放鬆", "group": False,
             "bio": "手法細膩，讓忙碌的你好好放鬆。"},
        ],
        "products": [
            {"name": "體驗療程（單次）", "category": "single_course", "hours": 1, "price": 990,
             "description": "第一次來的你，先體驗看看"},
            {"name": "臉部保養 5 次", "category": "single_course", "hours": 5, "price": 7500,
             "description": "定期保養，維持好膚況"},
            {"name": "舒壓按摩 10 次", "category": "single_course", "hours": 10, "price": 15000,
             "description": "每週一次，放鬆身心"},
            {"name": "保濕精華", "category": "supply", "stock": 10, "price": 1200},
        ],
        "course": None,
    },
}


def seed_sample_data(tenant: Tenant) -> None:
    """
    以這家店的應用程式帳號（受 RLS）建立範例資料：店名、2 位服務人員、方案、（健身）一門團體課、形象網站草稿。
    失敗只記錄，不影響已經開通的店家。
    """
    db = db_session.tenant_session(tenant.id)
    token = current_tenant.set(
        TenantInfo(id=tenant.id, subdomain=tenant.subdomain, timezone=tenant.timezone,
                   business_type=tenant.business_type.name)
    )
    try:
        _seed(db, tenant)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("建立範例資料失敗（店家 %s）", tenant.subdomain)
    finally:
        current_tenant.reset(token)
        db.close()


def _seed(db: Session, tenant: Tenant) -> None:
    kind = tenant.business_type.name
    data = SAMPLE[kind]
    ids: dict[str, list[int]] = {"users": [], "coaches": [], "products": [], "courses": []}

    settings_row = db.query(SystemSettings).first()
    if settings_row is None:
        settings_row = SystemSettings(company_name=tenant.name)
        db.add(settings_row)
    if kind == "beauty":
        settings_row.group_classes_setting = None  # 依行業預設（美體關閉團體課程）

    coaches: list[Coach] = []
    for index, staff in enumerate(data["staff"], start=1):
        user = User(
            username=f"sample-staff{index}",
            password_hash=unusable_password(),
            role=UserRole.member,
            display_name=staff["name"],
        )
        db.add(user)
        db.flush()
        coach = Coach(
            user_id=user.id,
            name=staff["name"],
            phone="0900000000",
            specialty=staff["specialty"],
            is_private_coach=True,
            is_group_coach=staff["group"],
        )
        db.add(coach)
        db.flush()
        coaches.append(coach)
        ids["users"].append(user.id)
        ids["coaches"].append(coach.id)

    products: list[tuple[Product, str]] = []
    for p in data["products"]:
        category = ProductCategory[p["category"]]
        product = Product(
            name=p["name"],
            category=category,
            session_hours=p.get("hours", 0) if category != ProductCategory.supply else 0,
            stock=p.get("stock") if category == ProductCategory.supply else None,
            price=p["price"],
            is_active=True,
        )
        db.add(product)
        db.flush()
        products.append((product, p.get("description", "")))
        ids["products"].append(product.id)

    course_spec = data["course"]
    if course_spec:
        start = _next_monday(date.today())
        course = Course(
            name=course_spec["name"],
            code=f"GC-{start.year}-001",
            coach_id=coaches[0].id,
            duration_minutes=60,
            min_capacity=3,
            max_capacity=course_spec["capacity"],
            coach_fee=0,
            description=course_spec["description"],
            status=CourseStatus.on,
            start_hour=course_spec["hour"],
            start_date=start,
            end_mode=ScheduleEndMode.count,
            week_count=course_spec["weeks"],
            updated_by_name="範例資料",
        )
        position = 0
        for week in range(course_spec["weeks"]):
            for weekday in course_spec["weekdays"]:
                position += 1
                course.sessions.append(
                    CourseSession(
                        position=position,
                        session_date=start + timedelta(days=week * 7 + weekday - 1),
                        start_minute=course_spec["hour"] * 60,
                        duration_minutes=60,
                        source=SessionSource.scheduled,
                    )
                )
        for weekday in course_spec["weekdays"]:
            course.weekday_rows.append(CourseWeekday(weekday=weekday))
        course.day_of_week = min(course_spec["weekdays"])
        course.session_count = len(course.sessions)
        course.end_date = start + timedelta(days=course_spec["weeks"] * 7 - 1)
        db.add(course)
        db.flush()
        ids["courses"].append(course.id)
        group_product = Product(
            name=course_spec["product"],
            category=ProductCategory.course,
            course_id=course.id,
            session_hours=course.session_count,
            price=course_spec["price"],
            is_active=True,
        )
        db.add(group_product)
        db.flush()
        products.append((group_product, "整期報名，每週固定上課"))
        ids["products"].append(group_product.id)

    # 形象網站草稿：放上範例服務人員與方案（不發布）
    from app.services.website import get_or_create_website

    site = get_or_create_website(db)
    draft = SiteContent.model_validate(site.draft).model_dump(mode="json")
    draft["coaches"]["items"] = [{"coach_id": c.id, "bio": staff["bio"]} for c, staff in zip(coaches, data["staff"])]
    draft["pricing"]["items"] = [
        {"product_id": p.id, "description": desc} for p, desc in products if p.category != ProductCategory.supply
    ]
    site.draft = SiteContent.model_validate(draft).model_dump(mode="json")

    settings_row.sample_data = ids
    db.flush()


def _next_monday(today: date) -> date:
    return today + timedelta(days=(7 - today.weekday()) % 7 or 7)


def clear_sample_data(db: Session) -> dict[str, int]:
    """
    清除範例資料（店家後台，呼叫端 commit）。已經被預約或購買用到的不刪：方案改下架、課程改下架並封存、
    服務人員保留。形象網站草稿與已發布內容裡的範例項目一併移除。回傳刪除與保留的數量。
    """
    settings_row = db.query(SystemSettings).first()
    ids = (settings_row.sample_data if settings_row else None) or {}
    removed = kept = 0

    product_ids = ids.get("products", [])
    used_products = {
        pid for (pid,) in db.query(Purchase.product_id).filter(Purchase.product_id.in_(product_ids)).distinct()
    } | {pid for (pid,) in db.query(Reservation.product_id).filter(Reservation.product_id.in_(product_ids)).distinct()}
    gone_products: set[int] = set()
    for product in db.query(Product).filter(Product.id.in_(product_ids)):
        if product.id in used_products:
            product.is_active = False
            kept += 1
        else:
            db.delete(product)
            gone_products.add(product.id)
            removed += 1
    db.flush()

    course_ids = ids.get("courses", [])
    used_courses = {
        cid for (cid,) in db.query(Reservation.course_id).filter(Reservation.course_id.in_(course_ids)).distinct()
    } | {cid for (cid,) in db.query(Product.course_id).filter(Product.course_id.in_(course_ids)).distinct()}
    for course in db.query(Course).filter(Course.id.in_(course_ids)):
        if course.id in used_courses:
            course.status = CourseStatus.off
            course.is_archived = True
            course.archived_at = datetime.utcnow()
            course.archived_by_name = "清除範例資料"
            kept += 1
        else:
            db.delete(course)
            removed += 1
    db.flush()

    coach_ids = ids.get("coaches", [])
    used_coaches = {
        cid for (cid,) in db.query(Reservation.coach_id).filter(Reservation.coach_id.in_(coach_ids)).distinct()
    } | {cid for (cid,) in db.query(Course.coach_id).filter(Course.coach_id.in_(coach_ids)).distinct()}
    gone_coaches: set[int] = set()
    for coach in db.query(Coach).filter(Coach.id.in_(coach_ids)):
        if coach.id in used_coaches:
            kept += 1
            continue
        user_id = coach.user_id
        db.delete(coach)
        db.flush()
        user = db.get(User, user_id)
        has_activity = (
            db.query(Reservation.id).filter(Reservation.member_id == user_id).first()
            or db.query(Purchase.id).filter(Purchase.user_id == user_id).first()
        )
        if user is not None and not has_activity:
            db.delete(user)
        gone_coaches.add(coach.id)
        removed += 1
    db.flush()

    site = db.query(Website).first()
    if site is not None:
        for attr in ("draft", "published"):
            raw = getattr(site, attr)
            if not raw:
                continue
            content = SiteContent.model_validate(raw)
            content.coaches.items = [i for i in content.coaches.items if i.coach_id not in gone_coaches]
            content.pricing.items = [i for i in content.pricing.items if i.product_id not in gone_products]
            setattr(site, attr, content.model_dump(mode="json"))

    if settings_row is not None:
        settings_row.sample_data = None
    db.flush()
    return {"removed": removed, "kept": kept}


def is_expired(tenant: Tenant) -> bool:
    return trial_expired(tenant.status, tenant.trial_ends_at)


def login_url(subdomain: str) -> str:
    return f"{settings.PUBLIC_SCHEME}://{subdomain}.{settings.BASE_DOMAIN}/login"


"""
開店設定清單（ADR 0016）：從店家的實際資料判斷每一步做完了沒有，不靠店家手動打勾。

範例資料（自助試用開通時建立，ADR 0013）不算數：system_settings.sample_data 裡的 id 都排除，
所以清單會一直提醒「建立你自己的方案」，直到店家真的建了一個。
文字與連結由前端依行業用詞產生（frontend/src/pages/admin/Dashboard/components/SetupChecklist.tsx）。
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import exists, select, text
from sqlalchemy.orm import Session

from app.models.coach import Coach
from app.models.line_oa import LineOaChannel
from app.models.product import Product, ProductCategory
from app.models.system_settings import SystemSettings
from app.models.tenant import Tenant, TenantStatus
from app.models.user import User, UserRole
from app.models.website import Website
from app.services.shop import _real

# 試用中的店家：每完成一項必做 +1 天，全部完成再 +4 天（R66）。與 migration 0018 的 claim_setup_bonus() 一致
BONUS_DAYS_PER_STEP = 1
BONUS_COMPLETION_DAYS = 4

# 順序就是清單上的順序；optional 的不影響「完成」
STEPS: tuple[tuple[str, bool], ...] = (
    ("profile", False),  # 店名與 LOGO
    ("payment", False),  # 付款方式說明
    ("staff", False),  # 新增教練／美容師
    ("plans", False),  # 建立方案
    ("website", False),  # 發布形象網站
    ("members", False),  # 第一位會員
    ("line", True),  # 串接 LINE 官方帳號（選做）
)


@dataclass
class Step:
    key: str
    done: bool
    optional: bool


@dataclass
class Checklist:
    steps: list[Step]
    dismissed: bool

    @property
    def done_count(self) -> int:
        return sum(1 for s in self.steps if s.done and not s.optional)

    @property
    def required_count(self) -> int:
        return sum(1 for s in self.steps if not s.optional)

    @property
    def completed(self) -> bool:
        return self.done_count == self.required_count


def _sample_ids(row: SystemSettings | None, kind: str) -> list[int]:
    data = (row.sample_data or {}) if row else {}
    return [int(i) for i in data.get(kind, []) if isinstance(i, int) or str(i).isdigit()]


def checklist(db: Session) -> Checklist:
    row = db.query(SystemSettings).first()
    sample_users = _sample_ids(row, "users")
    sample_coaches = _sample_ids(row, "coaches")
    sample_products = _sample_ids(row, "products")

    coaches = db.query(Coach.id)
    if sample_coaches:
        coaches = coaches.filter(Coach.id.notin_(sample_coaches))
    plans = db.query(Product.id).filter(Product.is_active.is_(True), Product.category != ProductCategory.supply)
    if sample_products:
        plans = plans.filter(Product.id.notin_(sample_products))
    # 會員：一般會員帳號，不含範例人員帳號、也不含綁定成教練的帳號
    members = db.query(User.id).filter(
        User.role == UserRole.member, ~exists(select(Coach.id).where(Coach.user_id == User.id))
    )
    if sample_users:
        members = members.filter(User.id.notin_(sample_users))
    site = db.query(Website).first()
    line = db.query(LineOaChannel).first()

    done = {
        "profile": bool(row and _real(row.company_name) and row.logo_url),
        "payment": bool(row and (row.payment_instructions or "").strip()),
        "staff": coaches.first() is not None,
        "plans": plans.first() is not None,
        "website": bool(site and site.published),
        "members": members.first() is not None,
        "line": bool(line and line.is_enabled),
    }
    return Checklist(
        steps=[Step(key=key, done=done[key], optional=optional) for key, optional in STEPS],
        dismissed=bool(row and row.onboarding_dismissed_at),
    )


@dataclass
class Bonus:
    # available：還有天數可以拿；granted：全部拿到了；None：不是試用中（或沒有到期日），不適用
    status: str | None
    earned_days: int
    total_days: int
    granted_steps: list[str]
    trial_ends_at: datetime | None
    just_granted_days: int = 0


def _required_keys() -> list[str]:
    return [key for key, optional in STEPS if not optional]


def bonus(db: Session, tenant_id: int) -> Bonus:
    required = _required_keys()
    total = len(required) * BONUS_DAYS_PER_STEP + BONUS_COMPLETION_DAYS
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        return Bonus(None, 0, total, [], None)
    steps = [s for s in (tenant.setup_bonus_steps or []) if s in required]
    earned = len(steps) * BONUS_DAYS_PER_STEP + (BONUS_COMPLETION_DAYS if tenant.setup_bonus_at else 0)
    if tenant.setup_bonus_at is not None:
        return Bonus("granted", earned, total, steps, tenant.trial_ends_at)
    if tenant.status == TenantStatus.trial and tenant.trial_ends_at is not None:
        return Bonus("available", earned, total, steps, tenant.trial_ends_at)
    if steps:  # 拿過部分天數後轉為正式：保留紀錄，不再送
        return Bonus(None, earned, total, steps, None)
    return Bonus(None, 0, total, [], None)


def claim_bonus(db: Session, tenant_id: int, c: Checklist) -> Bonus:
    """依目前完成的步驟送天數（SECURITY DEFINER 函式；送過的步驟不再送，不收回）。呼叫端 commit。"""
    current = bonus(db, tenant_id)
    if current.status != "available":
        return current
    done = [s.key for s in c.steps if s.done and not s.optional and s.key not in current.granted_steps]
    if not done and not c.completed:
        return current
    days = db.execute(
        text("SELECT claim_setup_bonus(CAST(:steps AS text[]), :completed)"),
        {"steps": done, "completed": c.completed},
    ).scalar() or 0
    if days == 0:
        return current
    db.expire_all()
    result = bonus(db, tenant_id)
    result.just_granted_days = days
    return result

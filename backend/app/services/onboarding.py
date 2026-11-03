"""
開店設定清單（ADR 0016）：從店家的實際資料判斷每一步做完了沒有，不靠店家手動打勾。

範例資料（自助試用開通時建立，ADR 0013）不算數：system_settings.sample_data 裡的 id 都排除，
所以清單會一直提醒「建立你自己的方案」，直到店家真的建了一個。
文字與連結由前端依行業用詞產生（frontend/src/pages/admin/Dashboard/components/SetupChecklist.tsx）。
"""

from dataclasses import dataclass

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.coach import Coach
from app.models.line_oa import LineOaChannel
from app.models.product import Product, ProductCategory
from app.models.system_settings import SystemSettings
from app.models.user import User, UserRole
from app.models.website import Website
from app.services.shop import _real

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

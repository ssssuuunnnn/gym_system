"""
後台帳號與功能權限（見 docs/adr/0008-staff-permissions.md、R37–R39）。

- 主要管理者：全部功能＋管理後台帳號、權限、移交主要管理者；每家一位
- 管理者：全部功能，不能管理後台帳號
- 一般使用者：只能用被勾選的功能；功能＝後台側欄的選單
後端每個管理用 API 以 deps.require_perm(<功能>) 檢查；權限每次請求都從資料庫讀，修改立即生效。
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.staff_audit import StaffAuditLog
from app.models.user import StaffLevel, User, UserRole

# 功能代碼 → 名稱、是否含敏感資料、說明（順序＝後台側欄順序）
PERMISSIONS: list[dict] = [
    {"code": "dashboard", "label": "儀表板", "sensitive": False, "hint": "今日預約與營運摘要"},
    {"code": "reservations", "label": "預約審核", "sensitive": False, "hint": "審核、建立、取消預約與簽到"},
    {"code": "coaches", "label": "教練管理", "sensitive": True, "hint": "教練資料，含電話與匯款帳號"},
    {"code": "payouts", "label": "教練鐘點", "sensitive": True, "hint": "鐘點費、結算與撥款"},
    {"code": "products", "label": "商品管理", "sensitive": False, "hint": "方案與商品、價格、庫存"},
    {"code": "purchases", "label": "購買紀錄", "sensitive": False, "hint": "登錄購買、確認收款、調整堂數"},
    {"code": "courses", "label": "課程管理", "sensitive": False, "hint": "團體課程與排程"},
    {"code": "availability", "label": "公休設定", "sensitive": False, "hint": "各分店的公休時段"},
    {"code": "members", "label": "會員管理", "sensitive": True, "hint": "會員資料（含手機）、密碼、黑名單"},
    {"code": "segments", "label": "會員名單", "sensitive": False, "hint": "篩選名單、建立 LINE 受眾"},
    {"code": "coupons", "label": "優惠券", "sensitive": False, "hint": "建立體驗券與折價券、發給會員"},
    {"code": "website", "label": "形象網站", "sensitive": False, "hint": "編輯與發布網站"},
    {"code": "inquiries", "label": "詢問名單", "sensitive": False, "hint": "體驗課詢問與轉為會員"},
    {"code": "branches", "label": "分店管理", "sensitive": False, "hint": "新增、編輯、停用分店"},
    {"code": "settings", "label": "系統設定", "sensitive": True, "hint": "公司資料、預約規則、LINE 金鑰"},
]
PERMISSION_CODES = [p["code"] for p in PERMISSIONS]
LABEL = {p["code"]: p["label"] for p in PERMISSIONS}

# 內建角色範本：只是幫忙勾選，實際存在每個帳號自己的 permissions（R38）
TEMPLATES: list[dict] = [
    {
        "key": "front_desk",
        "label": "櫃台",
        "codes": ["dashboard", "reservations", "purchases", "availability", "members", "inquiries"],
    },
    {
        "key": "store_manager",
        "label": "店長",
        "codes": [
            "dashboard", "reservations", "coaches", "products", "purchases", "courses",
            "availability", "members", "segments", "coupons", "website", "inquiries", "branches",
        ],
    },
    {"key": "accountant", "label": "會計", "codes": ["dashboard", "purchases", "payouts"]},
]


def level_of(user: User) -> StaffLevel | None:
    """後台帳號的身分；舊資料沒有設定時視為管理者。會員帳號回 None。"""
    if user.role != UserRole.admin:
        return None
    return user.staff_level or StaffLevel.manager


def effective_permissions(user: User) -> list[str]:
    level = level_of(user)
    if level is None:
        return []
    if level in (StaffLevel.owner, StaffLevel.manager):
        return list(PERMISSION_CODES)
    return [c for c in PERMISSION_CODES if c in (user.permissions or [])]


def has_perm(user: User, *codes: str) -> bool:
    """有其中任何一項功能權限就算（共用的名單讀取會開給幾個功能）。"""
    allowed = effective_permissions(user)
    return any(c in allowed for c in codes)


def clean_codes(codes: list[str]) -> list[str]:
    wanted = set(codes)
    unknown = wanted - set(PERMISSION_CODES)
    if unknown:
        raise ValueError(f"不認得的功能：{', '.join(sorted(unknown))}")
    return [c for c in PERMISSION_CODES if c in wanted]


def find_owner(db: Session) -> User | None:
    return db.query(User).filter(User.role == UserRole.admin, User.staff_level == StaffLevel.owner).first()


def initial_level(db: Session) -> StaffLevel:
    """新建的管理員：這家還沒有主要管理者就當主要管理者，否則是管理者。"""
    return StaffLevel.manager if find_owner(db) else StaffLevel.owner


def ensure_owner(db: Session) -> User | None:
    """
    沒有主要管理者時（舊資料、主要管理者的資料被移除），把最早建立的啟用中管理員設為主要管理者。
    呼叫端 commit。
    """
    owner = find_owner(db)
    if owner is not None:
        return owner
    first = (
        db.query(User)
        .filter(User.role == UserRole.admin, User.is_active.is_(True))
        .order_by(User.id)
        .first()
    )
    if first is not None:
        first.staff_level = StaffLevel.owner
        db.flush()
    return first


def describe(user: User) -> str:
    return user.display_name or user.username


def audit(db: Session, actor: User, action: str, target: User | None, detail: str = "") -> None:
    db.add(
        StaffAuditLog(
            actor_id=actor.id,
            actor_name=describe(actor),
            target_id=target.id if target else None,
            target_name=describe(target) if target else None,
            action=action,
            detail=detail[:300],
            created_at=datetime.utcnow(),
        )
    )


def permission_diff(before: list[str], after: list[str]) -> str:
    added = [LABEL[c] for c in after if c not in before]
    removed = [LABEL[c] for c in before if c not in after]
    parts = []
    if added:
        parts.append("開啟 " + "、".join(added))
    if removed:
        parts.append("關閉 " + "、".join(removed))
    return "；".join(parts) or "沒有變更"

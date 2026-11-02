"""
收支報表（ADR 0014、R57–R60）：現金制。

- 收入：已付款的購買紀錄，依確認收款時間（paid_at，UTC）換成店家當地日期；金額＝實收（已扣優惠）。
- 支出：已撥款的教練鐘點，依撥款時間；依明細每一堂的分店分攤。
- 手動帳目：店家輸入的收入／支出（未刪除），依 entry_date。

這裡只讀資料與新增預設分類（flush），由呼叫端 commit。
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core import clock
from app.models.accounting import AccountingCategory, AccountingEntry, EntryKind
from app.models.coach_payout import CoachPayout, PayoutStatus
from app.models.product import ProductCategory
from app.models.purchase import PaymentStatus, Purchase
from app.services import terms

MAX_RANGE_DAYS = 366
MAX_TREND_MONTHS = 24

DEFAULT_CATEGORIES: dict[EntryKind, list[str]] = {
    EntryKind.income: ["場租收入", "其他收入"],
    EntryKind.expense: ["租金", "水電瓦斯", "人事薪資", "耗材用品", "行銷廣告", "設備維修", "其他支出"],
}

ZERO = Decimal("0")


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


# ---------- 分類 ----------


def ensure_categories(db: Session) -> None:
    """還沒有任何分類時建立預設分類（第一次打開記帳時）。"""
    if db.query(AccountingCategory.id).first() is not None:
        return
    for kind, names in DEFAULT_CATEGORIES.items():
        for i, name in enumerate(names):
            db.add(AccountingCategory(kind=kind, name=name, sort_order=i))
    db.flush()


def category_in_use(db: Session, category_id: int) -> bool:
    return db.query(AccountingEntry.id).filter(AccountingEntry.category_id == category_id).first() is not None


# ---------- 期間 ----------


def check_range(start: date, end: date) -> None:
    if end < start:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="結束日不能早於開始日")
    if (end - start).days >= MAX_RANGE_DAYS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="期間最長一年")


def utc_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    """當地日期 [start, end] → UTC 時間 [from, to)。"""
    return clock.to_utc(datetime.combine(start, time.min)), clock.to_utc(datetime.combine(end + timedelta(days=1), time.min))


def sales_label(category: ProductCategory) -> str:
    """商品類別的顯示名稱（依行業用詞，R48）。"""
    if category == ProductCategory.single_course:
        return terms.t("product_course")
    if category == ProductCategory.supply:
        return terms.t("product_supply")
    return category.value


# ---------- 明細 ----------


@dataclass
class Txn:
    """報表的一筆：銷售、鐘點撥款或手動帳目。"""

    day: date
    kind: EntryKind
    source: str  # sales / payout / manual
    category_key: str
    category: str
    description: str
    amount: Decimal
    payment_method: str | None
    branch_id: int | None
    ref_id: int
    discount: Decimal = ZERO

    def as_dict(self) -> dict:
        return {
            "date": self.day,
            "kind": self.kind.value,
            "source": self.source,
            "category_key": self.category_key,
            "category": self.category,
            "description": self.description,
            "amount": float(self.amount),
            "payment_method": self.payment_method,
            "branch_id": self.branch_id,
            "ref_id": self.ref_id,
        }


def _sales(db: Session, start: date, end: date, branch_id: int | None) -> list[Txn]:
    lo, hi = utc_bounds(start, end)
    query = (
        db.query(Purchase)
        .options(joinedload(Purchase.product), joinedload(Purchase.user))
        .filter(Purchase.payment_status == PaymentStatus.paid, Purchase.paid_at >= lo, Purchase.paid_at < hi)
    )
    if branch_id is not None:
        query = query.filter(Purchase.branch_id == branch_id)
    rows = []
    for p in query.all():
        member = p.user.display_name or p.user.username if p.user else ""
        rows.append(
            Txn(
                day=clock.to_local(p.paid_at).date(),
                kind=EntryKind.income,
                source="sales",
                category_key=f"sales:{p.product.category.name}",
                category=sales_label(p.product.category),
                description=f"{p.product.name} × {p.quantity}（{member}）",
                amount=money(p.amount),
                payment_method=p.payment_method.value if p.payment_method else None,
                branch_id=p.branch_id,
                ref_id=p.id,
                discount=money(p.discount_amount),
            )
        )
    return rows


def _payouts(db: Session, start: date, end: date, branch_id: int | None) -> list[Txn]:
    lo, hi = utc_bounds(start, end)
    payouts = (
        db.query(CoachPayout)
        .options(joinedload(CoachPayout.coach), joinedload(CoachPayout.items))
        .filter(CoachPayout.status == PayoutStatus.paid, CoachPayout.paid_at >= lo, CoachPayout.paid_at < hi)
        .all()
    )
    label = terms.t("staff_pay")
    rows = []
    for payout in payouts:
        # 依明細的分店分攤（一位教練一個月可能在幾間分店上課）
        by_branch: dict[int, Decimal] = defaultdict(lambda: ZERO)
        for item in payout.items:
            by_branch[item.branch_id] += money(item.fee)
        for b_id, amount in by_branch.items():
            if branch_id is not None and b_id != branch_id:
                continue
            if amount == 0:
                continue
            rows.append(
                Txn(
                    day=clock.to_local(payout.paid_at).date(),
                    kind=EntryKind.expense,
                    source="payout",
                    category_key="payout",
                    category=label,
                    description=f"{payout.coach.name} {payout.period:%Y-%m} {label}",
                    amount=amount,
                    payment_method="轉帳",
                    branch_id=b_id,
                    ref_id=payout.id,
                )
            )
    return rows


def _manual(db: Session, start: date, end: date, branch_id: int | None, shared: bool = False) -> list[Txn]:
    """手動帳目；shared=True 時只取全店共同（branch_id 為空）的帳目。"""
    query = (
        db.query(AccountingEntry)
        .options(joinedload(AccountingEntry.category))
        .filter(
            AccountingEntry.deleted_at.is_(None),
            AccountingEntry.entry_date >= start,
            AccountingEntry.entry_date <= end,
        )
    )
    if shared:
        query = query.filter(AccountingEntry.branch_id.is_(None))
    elif branch_id is not None:
        query = query.filter(AccountingEntry.branch_id == branch_id)
    return [
        Txn(
            day=e.entry_date,
            kind=e.kind,
            source="manual",
            category_key=f"manual:{e.category_id}",
            category=e.category.name,
            description=e.note or e.category.name,
            amount=money(e.amount),
            payment_method=e.payment_method.value,
            branch_id=e.branch_id,
            ref_id=e.id,
        )
        for e in query.all()
    ]


def transactions(db: Session, start: date, end: date, branch_id: int | None = None) -> list[Txn]:
    rows = _sales(db, start, end, branch_id) + _payouts(db, start, end, branch_id) + _manual(db, start, end, branch_id)
    return sorted(rows, key=lambda r: (r.day, r.kind.name, r.source, r.ref_id), reverse=True)


# ---------- 彙總 ----------


def _lines(rows: list[Txn]) -> list[dict]:
    groups: dict[str, dict] = {}
    for r in rows:
        g = groups.setdefault(
            r.category_key, {"key": r.category_key, "label": r.category, "source": r.source, "amount": ZERO, "count": 0}
        )
        g["amount"] += r.amount
        g["count"] += 1
    order = {"sales": 0, "payout": 0, "manual": 1}
    lines = sorted(groups.values(), key=lambda g: (order[g["source"]], -g["amount"], g["label"]))
    return [{**g, "amount": float(g["amount"])} for g in lines]


def _total(rows: list[Txn], kind: EntryKind) -> Decimal:
    return sum((r.amount for r in rows if r.kind == kind), ZERO)


def report(db: Session, start: date, end: date, branch_id: int | None = None) -> dict:
    check_range(start, end)
    rows = transactions(db, start, end, branch_id)
    income = [r for r in rows if r.kind == EntryKind.income]
    expense = [r for r in rows if r.kind == EntryKind.expense]

    methods: dict[str, dict] = {}
    for r in income:
        key = r.payment_method or "未填"
        m = methods.setdefault(key, {"method": key, "amount": ZERO, "count": 0})
        m["amount"] += r.amount
        m["count"] += 1

    sales = [r for r in income if r.source == "sales"]
    result = {
        "start": start,
        "end": end,
        "branch_id": branch_id,
        "income": float(_total(rows, EntryKind.income)),
        "expense": float(_total(rows, EntryKind.expense)),
        "net": float(_total(rows, EntryKind.income) - _total(rows, EntryKind.expense)),
        "income_lines": _lines(income),
        "expense_lines": _lines(expense),
        "payment_methods": sorted(
            ({**m, "amount": float(m["amount"])} for m in methods.values()), key=lambda m: -m["amount"]
        ),
        "discount_total": float(sum((r.discount for r in sales), ZERO)),
        "zero_amount_count": sum(1 for r in sales if r.amount == 0),
        "shared": None,
    }
    if branch_id is not None:
        # 看單一分店時，另外列出不屬於任何分店的手動帳目（R58）
        shared = _manual(db, start, end, None, shared=True)
        result["shared"] = {
            "income": float(_total(shared, EntryKind.income)),
            "expense": float(_total(shared, EntryKind.expense)),
        }
    return result


def month_start(d: date) -> date:
    return d.replace(day=1)


def add_months(d: date, n: int) -> date:
    y, m = divmod(d.month - 1 + n, 12)
    return date(d.year + y, m + 1, 1)


def trend(db: Session, months: int, branch_id: int | None = None) -> list[dict]:
    """近 months 個月（含本月）每月的收入、支出、淨額，舊到新。"""
    months = max(1, min(months, MAX_TREND_MONTHS))
    this_month = month_start(clock.now_local().date())
    first = add_months(this_month, -(months - 1))
    end = add_months(this_month, 1) - timedelta(days=1)
    buckets = {add_months(first, i): {"income": ZERO, "expense": ZERO} for i in range(months)}
    for r in transactions(db, first, end, branch_id):
        b = buckets.get(month_start(r.day))
        if b is not None:
            b["income" if r.kind == EntryKind.income else "expense"] += r.amount
    return [
        {
            "month": f"{m:%Y-%m}",
            "income": float(v["income"]),
            "expense": float(v["expense"]),
            "net": float(v["income"] - v["expense"]),
        }
        for m, v in buckets.items()
    ]

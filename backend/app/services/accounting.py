"""
收支報表（ADR 0014、R57–R60）與第二期（ADR 0015、R61–R64）。

現金制（basis="cash"）：

- 收入：已付款的購買紀錄，依確認收款時間（paid_at，UTC）換成店家當地日期；金額＝實收（已扣優惠）。
- 支出：已撥款的教練鐘點，依撥款時間；依明細每一堂的分店分攤。
- 手動帳目：店家輸入的收入／支出（未刪除），依 entry_date。

權責制（basis="accrual"，R61）：課程類方案依上課日認列（淨扣堂數 × 實收金額 ÷ 購買總堂數，總額不超過實收）、
用品依收款日、人員費用依已結算鐘點明細的上課日、手動帳目同現金制。
預收款（R62）＝已收款的課程類方案實收 − 已認列。關帳（R63）鎖住該月的手動帳目。

這裡只讀資料與新增預設分類／關帳列（flush），由呼叫端 commit。
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core import clock
from app.models.accounting import AccountingCategory, AccountingClose, AccountingEntry, EntryKind
from app.models.coach_payout import CoachPayout, CoachPayoutItem, PayoutStatus
from app.models.hour_ledger import HourLedger, HourLedgerReason
from app.models.product import Product, ProductCategory
from app.models.purchase import PaymentStatus, Purchase
from app.models.reservation import Reservation
from app.services import terms

MAX_RANGE_DAYS = 366
MAX_TREND_MONTHS = 24

DEFAULT_CATEGORIES: dict[EntryKind, list[str]] = {
    EntryKind.income: ["場租收入", "其他收入"],
    EntryKind.expense: ["租金", "水電瓦斯", "人事薪資", "耗材用品", "行銷廣告", "設備維修", "其他支出"],
}

ZERO = Decimal("0")

Basis = Literal["cash", "accrual"]
BASIS_LABEL = {"cash": "現金制", "accrual": "權責制"}


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


def _member_name(p: Purchase) -> str:
    return (p.user.display_name or p.user.username) if p.user else ""


def _sales(db: Session, start: date, end: date, branch_id: int | None, *, only_supply: bool = False) -> list[Txn]:
    lo, hi = utc_bounds(start, end)
    query = (
        db.query(Purchase)
        .options(joinedload(Purchase.product), joinedload(Purchase.user))
        .filter(Purchase.payment_status == PaymentStatus.paid, Purchase.paid_at >= lo, Purchase.paid_at < hi)
    )
    if only_supply:
        query = query.join(Product, Product.id == Purchase.product_id).filter(Product.category == ProductCategory.supply)
    if branch_id is not None:
        query = query.filter(Purchase.branch_id == branch_id)
    rows = []
    for p in query.all():
        member = _member_name(p)
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


# ---------- 權責制（R61）與預收款（R62） ----------


@dataclass
class Recognition:
    """一次認列：某筆購買在某天用掉幾堂、值多少錢、在哪間分店。"""

    purchase: Purchase
    day: date
    hours: Decimal
    value: Decimal
    branch_id: int
    reservation_id: int | None


def _course_purchases(db: Session, paid_before: datetime, purchase_branch_id: int | None = None) -> list[Purchase]:
    query = (
        db.query(Purchase)
        .options(joinedload(Purchase.product), joinedload(Purchase.user))
        .join(Product, Product.id == Purchase.product_id)
        .filter(
            Purchase.payment_status == PaymentStatus.paid,
            Purchase.paid_at < paid_before,
            Product.category != ProductCategory.supply,
            Purchase.total_hours > 0,
        )
    )
    if purchase_branch_id is not None:
        query = query.filter(Purchase.branch_id == purchase_branch_id)
    return query.all()


def recognitions(db: Session, purchases: list[Purchase], upto: date) -> dict[int, list[Recognition]]:
    """
    每筆購買到 upto（且不超過今天）為止的認列（R61），依日期排序。
    預約：淨扣堂數（扣抵 − 退回）在上課日認列；手動調整扣掉的堂數在調整當天認列；手動補的堂數沒有價值。
    每堂價值＝實收 ÷ 購買總堂數，同一筆購買累計不超過實收金額。
    """
    upto = min(upto, clock.now_local().date())
    ids = [p.id for p in purchases]
    if not ids:
        return {}
    ledger = (
        db.query(HourLedger)
        .filter(
            HourLedger.purchase_id.in_(ids),
            HourLedger.reason.in_(
                [HourLedgerReason.reservation_deduct, HourLedgerReason.reservation_refund, HourLedgerReason.manual_adjust]
            ),
        )
        .all()
    )
    res_ids = {row.reservation_id for row in ledger if row.reservation_id is not None}
    reservations = (
        {r.id: r for r in db.query(Reservation).filter(Reservation.id.in_(res_ids))} if res_ids else {}
    )

    per_purchase: dict[int, dict] = defaultdict(lambda: {"res": defaultdict(lambda: ZERO), "manual": []})
    for row in ledger:
        delta = Decimal(str(row.delta))
        if row.reservation_id is not None:
            per_purchase[row.purchase_id]["res"][row.reservation_id] -= delta  # 扣抵為負 → 用掉為正
        elif row.reason == HourLedgerReason.manual_adjust and delta < 0:
            per_purchase[row.purchase_id]["manual"].append((clock.to_local(row.created_at).date(), -delta))

    result: dict[int, list[Recognition]] = {}
    for p in purchases:
        amount = money(p.amount)
        total_hours = Decimal(str(p.total_hours))
        if amount <= 0 or total_hours <= 0:
            continue
        unit = amount / total_hours
        events: list[tuple[date, Decimal, int, int | None]] = []
        data = per_purchase.get(p.id)
        if data:
            for rid, hours in data["res"].items():
                r = reservations.get(rid)
                if r is not None and hours > 0 and r.booking_date <= upto:
                    events.append((r.booking_date, hours, r.branch_id, rid))
            for day, hours in data["manual"]:
                if day <= upto:
                    events.append((day, hours, p.branch_id, None))
        events.sort(key=lambda e: (e[0], e[3] or 0))
        done = ZERO
        rows = []
        for day, hours, b_id, rid in events:
            value = min((hours * unit).quantize(Decimal("0.01"), ROUND_HALF_UP), amount - done)
            if value <= 0 and hours <= 0:
                continue
            done += max(value, ZERO)
            rows.append(Recognition(p, day, hours, max(value, ZERO), b_id, rid))
        result[p.id] = rows
    return result


def _accrual_courses(db: Session, start: date, end: date, branch_id: int | None) -> list[Txn]:
    _, hi = utc_bounds(end, end)
    purchases = _course_purchases(db, hi)
    unit = terms.t("unit")
    rows = []
    for recs in recognitions(db, purchases, end).values():
        for rec in recs:
            if rec.day < start or rec.day > end or rec.value == 0:
                continue
            if branch_id is not None and rec.branch_id != branch_id:
                continue
            p = rec.purchase
            hours = f"{rec.hours.normalize():f}"
            what = f"{terms.t('attend')} {hours} {unit}" if rec.reservation_id else f"手動扣 {hours} {unit}"
            rows.append(
                Txn(
                    day=rec.day,
                    kind=EntryKind.income,
                    source="sales",
                    category_key=f"sales:{p.product.category.name}",
                    category=sales_label(p.product.category),
                    description=f"{p.product.name}（{_member_name(p)}）{what}",
                    amount=rec.value,
                    payment_method=None,
                    branch_id=rec.branch_id,
                    ref_id=p.id,
                )
            )
    return rows


def _accrual_payouts(db: Session, start: date, end: date, branch_id: int | None) -> list[Txn]:
    """已結算（含已撥款）的鐘點明細，依上課日；一筆結算在同一間分店合成一列。"""
    query = (
        db.query(CoachPayoutItem)
        .join(CoachPayout, CoachPayout.id == CoachPayoutItem.payout_id)
        .options(joinedload(CoachPayoutItem.payout).joinedload(CoachPayout.coach))
        .filter(
            CoachPayout.status.in_([PayoutStatus.settled, PayoutStatus.paid]),
            CoachPayoutItem.session_date >= start,
            CoachPayoutItem.session_date <= end,
        )
    )
    if branch_id is not None:
        query = query.filter(CoachPayoutItem.branch_id == branch_id)
    groups: dict[tuple[int, int], dict] = {}
    for item in query.all():
        g = groups.setdefault((item.payout_id, item.branch_id), {"payout": item.payout, "amount": ZERO, "day": item.session_date})
        g["amount"] += money(item.fee)
        g["day"] = max(g["day"], item.session_date)
    label = terms.t("staff_pay")
    return [
        Txn(
            day=g["day"],
            kind=EntryKind.expense,
            source="payout",
            category_key="payout",
            category=label,
            description=f"{g['payout'].coach.name} {g['payout'].period:%Y-%m} {label}（已結算）",
            amount=g["amount"],
            payment_method=None,
            branch_id=b_id,
            ref_id=payout_id,
        )
        for (payout_id, b_id), g in groups.items()
        if g["amount"] != 0
    ]


def transactions(
    db: Session, start: date, end: date, branch_id: int | None = None, basis: Basis = "cash"
) -> list[Txn]:
    if basis == "accrual":
        rows = (
            _accrual_courses(db, start, end, branch_id)
            + _sales(db, start, end, branch_id, only_supply=True)
            + _accrual_payouts(db, start, end, branch_id)
            + _manual(db, start, end, branch_id)
        )
    else:
        rows = _sales(db, start, end, branch_id) + _payouts(db, start, end, branch_id) + _manual(db, start, end, branch_id)
    return sorted(rows, key=lambda r: (r.day, r.kind.name, r.source, r.ref_id), reverse=True)


def months_without_settled_payouts(db: Session, start: date, end: date) -> list[str]:
    """權責制提示：期間內（到本月為止）還沒有任何已結算鐘點的月份。"""
    last = min(end, clock.now_local().date())
    months = []
    m = month_start(start)
    while m <= last:
        months.append(m)
        m = add_months(m, 1)
    settled = {
        p for (p,) in db.query(CoachPayout.period).filter(
            CoachPayout.status.in_([PayoutStatus.settled, PayoutStatus.paid]),
            CoachPayout.period >= month_start(start), CoachPayout.period <= last,
        ).distinct()
    }
    return [f"{m:%Y-%m}" for m in months if m not in settled]


def deferred(db: Session, as_of: date, branch_id: int | None = None) -> dict:
    """預收款（R62）：as_of 當天結束時，已收款、還沒認列的課程類方案金額，依方案彙總。"""
    _, hi = utc_bounds(as_of, as_of)
    purchases = _course_purchases(db, hi, branch_id)
    recs = recognitions(db, purchases, as_of)
    lines: dict[int, dict] = {}
    for p in purchases:
        done = [r for r in recs.get(p.id, [])]
        value = money(p.amount) - sum((r.value for r in done), ZERO)
        hours = max(Decimal(str(p.total_hours)) - sum((r.hours for r in done), ZERO), ZERO)
        if value <= 0:
            continue
        line = lines.setdefault(
            p.product_id,
            {"product_id": p.product_id, "label": p.product.name, "category": sales_label(p.product.category),
             "count": 0, "hours": ZERO, "amount": ZERO},
        )
        line["count"] += 1
        line["hours"] += hours
        line["amount"] += value
    ordered = sorted(lines.values(), key=lambda line: -line["amount"])
    return {
        "as_of": as_of,
        "branch_id": branch_id,
        "total": float(sum((line["amount"] for line in ordered), ZERO)),
        "hours": float(sum((line["hours"] for line in ordered), ZERO)),
        "lines": [{**line, "hours": float(line["hours"]), "amount": float(line["amount"])} for line in ordered],
    }


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


def report(db: Session, start: date, end: date, branch_id: int | None = None, basis: Basis = "cash") -> dict:
    check_range(start, end)
    rows = transactions(db, start, end, branch_id, basis)
    income = [r for r in rows if r.kind == EntryKind.income]
    expense = [r for r in rows if r.kind == EntryKind.expense]

    methods: dict[str, dict] = {}
    for r in income:
        if basis == "accrual" and r.payment_method is None:
            continue  # 權責制認列的課程收入沒有收款方式
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
        "basis": basis,
        "months_without_payouts": months_without_settled_payouts(db, start, end) if basis == "accrual" else [],
        "closed_months": [f"{m:%Y-%m}" for m in closed_months(db) if month_start(start) <= m <= end],
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


def trend(db: Session, months: int, branch_id: int | None = None, basis: Basis = "cash") -> list[dict]:
    """近 months 個月（含本月）每月的收入、支出、淨額，舊到新。"""
    months = max(1, min(months, MAX_TREND_MONTHS))
    this_month = month_start(clock.now_local().date())
    first = add_months(this_month, -(months - 1))
    end = add_months(this_month, 1) - timedelta(days=1)
    buckets = {add_months(first, i): {"income": ZERO, "expense": ZERO} for i in range(months)}
    for r in transactions(db, first, end, branch_id, basis):
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


# ---------- 關帳（R63） ----------


def closed_months(db: Session) -> set[date]:
    return {p for (p,) in db.query(AccountingClose.period).filter(AccountingClose.is_closed.is_(True))}


def ensure_open(db: Session, *days: date) -> None:
    """這些日期所在的月份有已關帳的 → 400。"""
    closed = closed_months(db)
    for d in days:
        if month_start(d) in closed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"{d.year} 年 {d.month} 月已關帳，不能修改這個月的帳目"
            )


def month_end(period: date) -> date:
    return add_months(period, 1) - timedelta(days=1)


def month_snapshot(db: Session, period: date) -> dict:
    """關帳快照：該月現金制、權責制的收入／支出／淨額，與月底預收款（全店）。"""
    end = month_end(period)
    snap = {}
    for basis in ("cash", "accrual"):
        r = report(db, period, end, None, basis)
        snap[basis] = {"income": r["income"], "expense": r["expense"], "net": r["net"]}
    snap["deferred"] = deferred(db, end)["total"]
    return snap

"""
收支報表第二期（ADR 0015、R61–R64）：權責制認列、預收款、關帳、收據照片。
"""

from datetime import date, datetime
from decimal import Decimal

import pytest

from app.core import clock
from app.core.config import settings
from app.core.security import hash_password
from app.models.coach import Coach
from app.models.coach_payout import CoachPayout, CoachPayoutItem, PayoutItemKind, PayoutStatus
from app.models.product import Product, ProductCategory
from app.models.purchase import PaymentMethod, PaymentStatus, Purchase
from app.models.reservation import Reservation, ReservationSource, ReservationStatus
from app.models.user import StaffLevel, User, UserRole
from app.services import hours
from tests.conftest import auth

API = "/api/v1"
JAN = {"start": "2030-01-01", "end": "2030-01-31"}
FEB = {"start": "2030-02-01", "end": "2030-02-28"}
MAR = {"start": "2030-03-01", "end": "2030-03-31"}
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


@pytest.fixture(autouse=True)
def now(monkeypatch):
    monkeypatch.setattr(clock, "now_local", lambda: datetime(2030, 3, 15, 9, 0))


@pytest.fixture(autouse=True)
def private_dir(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "PRIVATE_MEDIA_DIR", str(tmp_path / "private"))
    return tmp_path / "private"


@pytest.fixture()
def owner(db, admin):
    admin.staff_level = StaffLevel.owner
    db.commit()
    return admin


def buy(db, member, product, amount, total_hours, paid_at, *, branch_id=None):
    p = Purchase(
        user_id=member.id, product_id=product.id, quantity=1, purchase_date=paid_at.date(), amount=amount,
        total_hours=total_hours, remaining_hours=0, payment_status=PaymentStatus.paid,
        payment_method=PaymentMethod.cash, paid_at=paid_at, created_by=member.id, branch_id=branch_id,
    )
    db.add(p)
    db.flush()
    hours.record_purchase(db, p, created_by=member.id)
    db.commit()
    return p


def book(db, member, purchase, day, *, branch_id=None, refund=False):
    r = Reservation(
        member_id=member.id, product_id=purchase.product_id, purchase_id=purchase.id, booking_date=day,
        start_hour=10, status=ReservationStatus.confirmed, source=ReservationSource.admin_created, branch_id=branch_id,
    )
    db.add(r)
    hours.deduct_for_reservation(db, r, created_by=member.id)
    if refund:
        db.flush()  # 測試的 Session 沒有 autoflush，退回前先寫入扣抵
        r.status = ReservationStatus.cancelled
        hours.refund_reservation(db, r, created_by=member.id)
    db.commit()
    return r


def report(client, user, period, **params):
    res = client.get(f"{API}/accounting/report", params={**period, **params}, headers=auth(user))
    assert res.status_code == 200, res.text
    return res.json()


def deferred(client, user, **params):
    res = client.get(f"{API}/accounting/deferred", params=params, headers=auth(user))
    assert res.status_code == 200, res.text
    return res.json()


# ---------- R61 權責制 ----------


def test_accrual_recognises_classes_on_class_date(client, db, admin, member, pack, supply):
    p = buy(db, member, pack, 10000, 10, datetime(2030, 1, 5, 3))
    book(db, member, p, date(2030, 1, 10))
    book(db, member, p, date(2030, 1, 20))
    book(db, member, p, date(2030, 1, 25), refund=True)  # 取消退堂：不認列
    book(db, member, p, date(2030, 2, 3))
    book(db, member, p, date(2030, 3, 20))  # 還沒上（今天 3/15）
    paid_supply = Purchase(
        user_id=member.id, product_id=supply.id, quantity=1, purchase_date=date(2030, 1, 6), amount=1200,
        total_hours=0, remaining_hours=0, payment_status=PaymentStatus.paid, payment_method=PaymentMethod.cash,
        paid_at=datetime(2030, 1, 6, 3), created_by=member.id,
    )
    db.add(paid_supply)
    db.commit()

    cash = report(client, admin, JAN)
    assert cash["basis"] == "cash" and cash["income"] == 11200
    jan = report(client, admin, JAN, basis="accrual")
    assert jan["basis"] == "accrual" and jan["income"] == 3200  # 2 堂 × 1000 ＋ 用品
    assert {line["label"]: line["amount"] for line in jan["income_lines"]} == {"課程": 2000, "用品": 1200}
    assert report(client, admin, FEB, basis="accrual")["income"] == 1000
    assert report(client, admin, MAR, basis="accrual")["income"] == 0

    rows = client.get(f"{API}/accounting/transactions", params={**JAN, "basis": "accrual"}, headers=auth(admin)).json()
    assert [r["date"] for r in rows if r["category"] == "課程"] == ["2030-01-20", "2030-01-10"]
    assert "上課 1 堂" in rows[0]["description"]

    trend = client.get(f"{API}/accounting/trend", params={"months": 3, "basis": "accrual"}, headers=auth(admin)).json()
    assert [t["income"] for t in trend] == [3200, 1000, 0]


def test_accrual_caps_at_paid_amount_and_handles_manual_adjust(client, db, admin, member, pack):
    gift = buy(db, member, pack, 900, 3, datetime(2030, 1, 2))
    hours.adjust(db, gift, Decimal(2), created_by=admin.id, note="贈送")  # 補的堂數沒有價值
    db.commit()
    for d in (3, 4, 5, 6, 7):
        book(db, member, gift, date(2030, 1, d))
    assert report(client, admin, JAN, basis="accrual")["income"] == 900

    cut = buy(db, member, pack, 800, 4, datetime(2030, 1, 2))
    entry = hours.adjust(db, cut, Decimal(-1), created_by=admin.id, note="過期")
    entry.created_at = datetime(2030, 2, 1, 4)  # 台北 2/1 中午
    db.commit()
    assert report(client, admin, FEB, basis="accrual")["income"] == 200


def test_accrual_uses_class_branch(client, db, admin, member, pack):
    main = client.get(f"{API}/branches", headers=auth(admin)).json()[0]["id"]
    other = client.post(f"{API}/branches", json={"name": "信義店"}, headers=auth(admin)).json()["id"]
    p = buy(db, member, pack, 10000, 10, datetime(2030, 1, 2), branch_id=main)
    book(db, member, p, date(2030, 1, 10), branch_id=other)
    assert report(client, admin, JAN, basis="accrual", branch_id=other)["income"] == 1000
    assert report(client, admin, JAN, basis="accrual", branch_id=main)["income"] == 0
    assert report(client, admin, JAN, basis="cash", branch_id=main)["income"] == 10000


def test_accrual_staff_costs_from_settled_payouts(client, db, admin):
    u = User(username="coach", password_hash=hash_password("pw"), role=UserRole.member)
    db.add(u)
    db.commit()
    coach = Coach(user_id=u.id, name="王教練", phone="0900")
    db.add(coach)
    db.commit()
    main = client.get(f"{API}/branches", headers=auth(admin)).json()[0]["id"]
    payout = CoachPayout(
        coach_id=coach.id, period=date(2030, 1, 1), session_count=2, rate=800, amount=1600,
        status=PayoutStatus.settled, settled_by=admin.id,
        items=[
            CoachPayoutItem(kind=PayoutItemKind.private, title="私人課", session_date=date(2030, 1, d), start_hour=10,
                            fee=800, attended_count=1, no_show_count=0, members="m", branch_id=main)
            for d in (8, 9)
        ],
    )
    db.add(payout)
    db.commit()
    jan = report(client, admin, JAN, basis="accrual")
    assert jan["expense"] == 1600 and jan["months_without_payouts"] == []
    assert report(client, admin, JAN, basis="cash")["expense"] == 0  # 還沒撥款
    q1 = report(client, admin, {"start": "2030-01-01", "end": "2030-03-31"}, basis="accrual")
    assert q1["months_without_payouts"] == ["2030-02", "2030-03"]


# ---------- R62 預收款 ----------


def test_deferred_balance(client, db, admin, member, pack):
    main = client.get(f"{API}/branches", headers=auth(admin)).json()[0]["id"]
    other = client.post(f"{API}/branches", json={"name": "信義店"}, headers=auth(admin)).json()["id"]
    p = buy(db, member, pack, 10000, 10, datetime(2030, 1, 5, 3), branch_id=main)
    buy(db, member, pack, 3000, 3, datetime(2030, 2, 10, 3), branch_id=other)
    book(db, member, p, date(2030, 1, 10))
    book(db, member, p, date(2030, 1, 20))
    book(db, member, p, date(2030, 3, 20))  # 已扣堂但還沒上：仍是預收

    end_jan = deferred(client, admin, as_of="2030-01-31")
    assert end_jan["total"] == 8000 and end_jan["hours"] == 8
    today = deferred(client, admin)
    assert today["as_of"] == "2030-03-15" and today["total"] == 11000 and today["hours"] == 11
    assert today["lines"] == [
        {"product_id": pack.id, "label": pack.name, "category": "課程", "count": 2, "hours": 11, "amount": 11000}
    ]
    assert deferred(client, admin, branch_id=other)["total"] == 3000
    assert deferred(client, admin, as_of="2030-01-01")["total"] == 0


# ---------- R63 關帳 ----------


def test_close_month_locks_entries(client, db, owner, member, pack):
    h = auth(owner)
    mgr = User(username="mgr", password_hash=hash_password("pw"), role=UserRole.admin, staff_level=StaffLevel.manager)
    db.add(mgr)
    db.commit()
    buy(db, member, pack, 5000, 5, datetime(2030, 1, 5, 3))
    cats = client.get(f"{API}/accounting/categories", headers=h).json()
    rent = next(c for c in cats if c["name"] == "租金")
    body = {"kind": "支出", "category_id": rent["id"], "entry_date": "2030-01-10", "amount": 2000, "payment_method": "轉帳"}
    jan_entry = client.post(f"{API}/accounting/entries", json=body, headers=h).json()
    feb_entry = client.post(f"{API}/accounting/entries", json={**body, "entry_date": "2030-02-10"}, headers=h).json()

    assert client.post(f"{API}/accounting/closes", json={"month": "2030-03"}, headers=h).status_code == 400
    closed = client.post(f"{API}/accounting/closes", json={"month": "2030-01"}, headers=h)
    assert closed.status_code == 201, closed.text
    snap = closed.json()["snapshot"]
    assert snap["cash"] == {"income": 5000, "expense": 2000, "net": 3000}
    assert snap["accrual"] == {"income": 0, "expense": 2000, "net": -2000}
    assert snap["deferred"] == 5000
    assert closed.json()["closed_by_name"] == "admin"
    assert client.post(f"{API}/accounting/closes", json={"month": "2030-01"}, headers=h).status_code == 409

    # 該月帳目鎖住：新增、修改、刪除、把別月帳目改進該月、上傳收據都不行
    assert client.post(f"{API}/accounting/entries", json=body, headers=h).status_code == 400
    assert client.put(f"{API}/accounting/entries/{jan_entry['id']}", json={**body, "amount": 1}, headers=h).status_code == 400
    assert client.delete(f"{API}/accounting/entries/{jan_entry['id']}", headers=h).status_code == 400
    moved = client.put(f"{API}/accounting/entries/{feb_entry['id']}", json=body, headers=h)
    assert moved.status_code == 400 and "已關帳" in moved.json()["detail"]
    up = client.post(f"{API}/accounting/entries/{jan_entry['id']}/receipt",
                     files={"file": ("r.png", PNG, "image/png")}, headers=h)
    assert up.status_code == 400
    # 二月照常
    assert client.put(f"{API}/accounting/entries/{feb_entry['id']}", json={**body, "entry_date": "2030-02-11"},
                      headers=h).status_code == 200
    assert report(client, owner, JAN)["closed_months"] == ["2030-01"]

    # 重新開帳：只有主要管理者
    assert client.post(f"{API}/accounting/closes/2030-01/reopen", headers=auth(mgr)).status_code == 403
    reopened = client.post(f"{API}/accounting/closes/2030-01/reopen", headers=h).json()
    assert reopened["is_closed"] is False and reopened["reopened_by_name"] == "admin"
    assert client.delete(f"{API}/accounting/entries/{jan_entry['id']}", headers=h).status_code == 200
    assert client.post(f"{API}/accounting/closes/2030-01/reopen", headers=h).status_code == 400
    # 再關一次：同一列重拍快照
    again = client.post(f"{API}/accounting/closes", json={"month": "2030-01"}, headers=h).json()
    assert again["snapshot"]["cash"]["expense"] == 0 and again["reopened_by_name"] == "admin"
    assert len(client.get(f"{API}/accounting/closes", headers=h).json()) == 1


# ---------- R64 收據 ----------


def test_receipt_upload_read_and_privacy(client, beta_client, db, admin, beta_admin, private_dir):
    h = auth(admin)
    cats = client.get(f"{API}/accounting/categories", headers=h).json()
    rent = next(c for c in cats if c["name"] == "租金")
    body = {"kind": "支出", "category_id": rent["id"], "entry_date": "2030-02-10", "amount": 2000, "payment_method": "轉帳"}
    e = client.post(f"{API}/accounting/entries", json=body, headers=h).json()
    assert e["has_receipt"] is False
    url = f"{API}/accounting/entries/{e['id']}/receipt"
    assert client.get(url, headers=h).status_code == 404

    assert client.post(url, files={"file": ("a.txt", b"hello", "text/plain")}, headers=h).status_code == 400
    fake = client.post(url, files={"file": ("a.png", b"not-a-png", "image/png")}, headers=h)
    assert fake.status_code == 400 and "不符" in fake.json()["detail"]
    big = client.post(url, files={"file": ("a.png", PNG + b"0" * (5 * 1024 * 1024), "image/png")}, headers=h)
    assert big.status_code == 400

    ok = client.post(url, files={"file": ("r.png", PNG, "image/png")}, headers=h)
    assert ok.status_code == 200 and ok.json()["has_receipt"] is True
    stored = list(private_dir.rglob("*.png"))
    assert len(stored) == 1 and stored[0].parent.name == "receipts" and stored[0].parent.parent.name == "alpha"
    # 不在公開的 /media
    assert client.get(f"/media/alpha/receipts/{stored[0].name}").status_code == 404

    got = client.get(url, headers=h)
    assert got.status_code == 200 and got.content == PNG
    assert got.headers["content-type"] == "image/png"
    assert got.headers["cache-control"] == "private, no-store"
    assert got.headers["x-content-type-options"] == "nosniff"
    assert "attachment" in got.headers["content-disposition"]

    pdf = client.post(url, files={"file": ("r.pdf", b"%PDF-1.4 test", "application/pdf")}, headers=h)
    assert pdf.status_code == 200
    assert client.get(url, headers=h).headers["content-type"] == "application/pdf"

    desk = User(username="desk", password_hash=hash_password("pw"), role=UserRole.admin,
                staff_level=StaffLevel.staff, permissions=["purchases"])
    db.add(desk)
    db.commit()
    assert client.get(url, headers=auth(desk)).status_code == 403
    assert beta_client.get(url, headers=auth(beta_admin)).status_code == 404

    # 刪除帳目後仍可看收據；移除收據
    client.delete(f"{API}/accounting/entries/{e['id']}", headers=h)
    assert client.get(url, headers=h).status_code == 200
    e2 = client.post(f"{API}/accounting/entries", json=body, headers=h).json()
    url2 = f"{API}/accounting/entries/{e2['id']}/receipt"
    client.post(url2, files={"file": ("r.jpg", b"\xff\xd8\xff\xe0jpeg", "image/jpeg")}, headers=h)
    removed = client.delete(url2, headers=h).json()
    assert removed["has_receipt"] is False and client.get(url2, headers=h).status_code == 404


def test_report_rejects_unknown_basis(client, admin):
    assert client.get(f"{API}/accounting/report", params={**JAN, "basis": "x"}, headers=auth(admin)).status_code == 422

"""
收支報表（ADR 0014、R57–R60）：現金制計入、購買紀錄的分店、鐘點依分店分攤、手動帳目與分類、權限與租戶隔離。
"""

from datetime import date, datetime

import pytest

from app.core import clock
from app.core.security import hash_password
from app.models.coach import Coach
from app.models.coach_payout import CoachPayout, CoachPayoutItem, PayoutItemKind, PayoutStatus
from app.models.course import Course
from app.models.product import Product, ProductCategory
from app.models.purchase import PaymentMethod, PaymentStatus, Purchase
from app.models.user import StaffLevel, User, UserRole
from tests.conftest import auth

API = "/api/v1"
JAN = {"start": "2030-01-01", "end": "2030-01-31"}


@pytest.fixture(autouse=True)
def now(monkeypatch):
    monkeypatch.setattr(clock, "now_local", lambda: datetime(2030, 2, 15, 9, 0))


@pytest.fixture()
def branches(client, admin):
    """總店（自動建立）＋信義店。"""
    main = client.get(f"{API}/branches", headers=auth(admin)).json()[0]
    res = client.post(f"{API}/branches", json={"name": "信義店", "sort_order": 1}, headers=auth(admin))
    assert res.status_code == 201, res.text
    return main["id"], res.json()["id"]


def paid(db, member, product, amount, paid_at, *, branch_id=None, status=PaymentStatus.paid, discount=0,
         method=PaymentMethod.cash):
    p = Purchase(
        user_id=member.id, product_id=product.id, quantity=1, purchase_date=paid_at.date(), amount=amount,
        discount_amount=discount, total_hours=0, remaining_hours=0, payment_status=status,
        payment_method=method if status == PaymentStatus.paid else None,
        paid_at=paid_at if status == PaymentStatus.paid else None, created_by=member.id, branch_id=branch_id,
    )
    db.add(p)
    db.commit()
    return p


def report(client, user, **params):
    res = client.get(f"{API}/accounting/report", params={**JAN, **params}, headers=auth(user))
    assert res.status_code == 200, res.text
    return res.json()


def entry(client, user, kind, category, amount, *, day="2030-01-10", **extra):
    cats = client.get(f"{API}/accounting/categories", headers=auth(user)).json()
    cat = next(c for c in cats if c["name"] == category and c["kind"] == kind)
    body = {"kind": kind, "category_id": cat["id"], "entry_date": day, "amount": amount,
            "payment_method": "現金", **extra}
    return client.post(f"{API}/accounting/entries", json=body, headers=auth(user))


# ---------- R57 現金制 ----------


def test_income_is_paid_purchases_by_local_paid_date(client, db, admin, member, pack, supply):
    paid(db, member, pack, 10000, datetime(2030, 1, 5, 3, 0), discount=500)
    paid(db, member, supply, 1200, datetime(2030, 1, 6, 3, 0), method=PaymentMethod.transfer)
    # UTC 1/31 17:00＝台北 2/1 01:00 → 算二月
    paid(db, member, pack, 9999, datetime(2030, 1, 31, 17, 0))
    # UTC 12/31 16:30＝台北 1/1 00:30 → 算一月
    paid(db, member, supply, 300, datetime(2029, 12, 31, 16, 30))
    paid(db, member, pack, 5000, datetime(2030, 1, 7), status=PaymentStatus.unpaid)
    paid(db, member, pack, 5000, datetime(2030, 1, 7), status=PaymentStatus.cancelled)
    paid(db, member, pack, 0, datetime(2030, 1, 8), method=PaymentMethod.coupon)  # 體驗券

    r = report(client, admin)
    assert r["income"] == 11500 and r["expense"] == 0 and r["net"] == 11500
    lines = {line["label"]: (line["amount"], line["count"]) for line in r["income_lines"]}
    assert lines == {"課程": (10000, 2), "用品": (1500, 2)}
    methods = {m["method"]: m["amount"] for m in r["payment_methods"]}
    assert methods == {"現金": 10300, "轉帳": 1200, "體驗券": 0}
    assert r["discount_total"] == 500 and r["zero_amount_count"] == 1

    feb = report(client, admin, start="2030-02-01", end="2030-02-28")
    assert feb["income"] == 9999


def test_payouts_count_when_paid_and_split_by_branch(client, db, admin, branches):
    main_id, xinyi_id = branches
    u = User(username="coach", password_hash=hash_password("pw"), role=UserRole.member)
    db.add(u)
    db.commit()
    coach = Coach(user_id=u.id, name="王教練", phone="0900")
    db.add(coach)
    db.commit()

    def payout(period, status, paid_at, fees):
        items = [
            CoachPayoutItem(kind=PayoutItemKind.private, title="私人課", session_date=period, start_hour=10, fee=fee,
                            attended_count=1, no_show_count=0, members="m", branch_id=b)
            for b, fee in fees
        ]
        p = CoachPayout(coach_id=coach.id, period=period, session_count=len(items), rate=800,
                        amount=sum(f for _, f in fees), status=status, settled_by=admin.id, paid_at=paid_at,
                        items=items)
        db.add(p)
        db.commit()
        return p

    payout(date(2029, 12, 1), PayoutStatus.paid, datetime(2030, 1, 5, 2), [(main_id, 800), (xinyi_id, 1600)])
    payout(date(2029, 11, 1), PayoutStatus.settled, None, [(main_id, 999)])  # 還沒撥款不算

    r = report(client, admin)
    assert r["expense"] == 2400 and r["net"] == -2400
    assert r["expense_lines"] == [{"key": "payout", "label": "教練鐘點", "source": "payout", "amount": 2400, "count": 2}]
    assert report(client, admin, branch_id=xinyi_id)["expense"] == 1600
    assert report(client, admin, branch_id=main_id)["expense"] == 800


def test_settled_payout_items_record_branch(client, db, admin, member, branches, pack):
    """結算時每堂記下分店（預約的分店）。"""
    from app.models.reservation import Attendance, Reservation, ReservationSource, ReservationStatus

    _, xinyi_id = branches
    u = User(username="coach", password_hash=hash_password("pw"), role=UserRole.member)
    db.add(u)
    db.commit()
    coach = Coach(user_id=u.id, name="王教練", phone="0900", session_rate=800)
    coach.branch_ids = [xinyi_id]
    db.add(coach)
    db.commit()
    db.add(Reservation(member_id=member.id, product_id=pack.id, coach_id=coach.id, booking_date=date(2030, 1, 7),
                       start_hour=10, status=ReservationStatus.confirmed, source=ReservationSource.admin_created,
                       attendance=Attendance.attended, branch_id=xinyi_id))
    db.commit()
    res = client.post(f"{API}/coach-payouts", json={"coach_id": coach.id, "month": "2030-01"}, headers=auth(admin))
    assert res.status_code == 201, res.text
    assert db.query(CoachPayoutItem).filter(CoachPayoutItem.payout_id == res.json()["id"]).one().branch_id == xinyi_id


# ---------- R58 購買紀錄的分店 ----------


def test_purchase_branch_resolution(client, db, admin, member, branches, pack):
    main_id, xinyi_id = branches
    h = auth(admin)
    body = {"user_id": member.id, "quantity": 1, "purchase_date": "2030-01-05", "amount": 100,
            "payment_method": "現金"}

    # 一般方案：沒指定 → 預設分店；指定 → 那間
    assert client.post(f"{API}/purchases", json={**body, "product_id": pack.id}, headers=h).json()["branch_id"] == main_id
    got = client.post(f"{API}/purchases", json={**body, "product_id": pack.id, "branch_id": xinyi_id}, headers=h)
    assert got.json()["branch_id"] == xinyi_id

    # 只限信義店的方案 → 一律信義店
    only_xinyi = Product(name="信義限定", category=ProductCategory.single_course, session_hours=1, price=100)
    only_xinyi.branch_ids = [xinyi_id]
    # 兩間都可用但不含總店以外…：限總店＋信義店時，指定不在清單內的分店要拒絕
    both = Product(name="兩店", category=ProductCategory.single_course, session_hours=1, price=100)
    third = client.post(f"{API}/branches", json={"name": "板橋店", "sort_order": 2}, headers=h).json()["id"]
    both.branch_ids = [main_id, xinyi_id]
    db.add_all([only_xinyi, both])
    db.commit()
    assert client.post(f"{API}/purchases", json={**body, "product_id": only_xinyi.id, "branch_id": main_id},
                       headers=h).json()["branch_id"] == xinyi_id
    bad = client.post(f"{API}/purchases", json={**body, "product_id": both.id, "branch_id": third}, headers=h)
    assert bad.status_code == 400 and "不適用" in bad.json()["detail"]

    # 團體課程方案 → 課程的分店
    u = User(username="gcoach", password_hash=hash_password("pw"), role=UserRole.member)
    db.add(u)
    db.commit()
    coach = Coach(user_id=u.id, name="G", phone="0900", is_group_coach=True)
    coach.branch_ids = [xinyi_id]
    db.add(coach)
    db.commit()
    course = Course(name="瑜珈", coach_id=coach.id, max_capacity=10, branch_id=xinyi_id)
    db.add(course)
    db.commit()
    group_plan = Product(name="瑜珈 8 堂", category=ProductCategory.course, course_id=course.id, session_hours=8,
                         price=4000)
    db.add(group_plan)
    db.commit()
    # 會員自己購買：忽略會員選的分店，用課程的分店
    mine = client.post(f"{API}/purchases/self", json={"product_id": group_plan.id, "branch_id": main_id},
                       headers=auth(member))
    assert mine.status_code == 201 and mine.json()["branch_id"] == xinyi_id
    # 會員自己購買一般方案：用會員選的分店
    mine = client.post(f"{API}/purchases/self", json={"product_id": pack.id, "branch_id": xinyi_id},
                       headers=auth(member))
    assert mine.json()["branch_id"] == xinyi_id

    listed = client.get(f"{API}/purchases", params={"branch_id": main_id}, headers=h).json()
    assert {p["branch_id"] for p in listed} == {main_id}


def test_purchase_without_router_gets_branch(db, member, pack, branches):
    """其他建立購買紀錄的地方（體驗券兌換等）沒指定分店時自動補上。"""
    main_id, _ = branches
    p = paid(db, member, pack, 0, datetime(2030, 1, 5))
    assert p.branch_id == main_id


def test_branch_report_lists_shared_entries(client, db, admin, member, branches, pack):
    main_id, xinyi_id = branches
    paid(db, member, pack, 3000, datetime(2030, 1, 5), branch_id=xinyi_id)
    paid(db, member, pack, 5000, datetime(2030, 1, 5), branch_id=main_id)
    assert entry(client, admin, "支出", "租金", 20000, branch_id=xinyi_id).status_code == 201
    assert entry(client, admin, "支出", "行銷廣告", 1000).status_code == 201  # 全店共同
    assert entry(client, admin, "收入", "場租收入", 600).status_code == 201  # 全店共同

    whole = report(client, admin)
    assert whole["income"] == 8600 and whole["expense"] == 21000 and whole["shared"] is None
    xinyi = report(client, admin, branch_id=xinyi_id)
    assert xinyi["income"] == 3000 and xinyi["expense"] == 20000 and xinyi["net"] == -17000
    assert xinyi["shared"] == {"income": 600, "expense": 1000}


# ---------- R59 手動帳目與分類 ----------


def test_default_categories_and_management(client, admin):
    h = auth(admin)
    cats = client.get(f"{API}/accounting/categories", headers=h).json()
    assert [c["name"] for c in cats if c["kind"] == "收入"] == ["場租收入", "其他收入"]
    assert "租金" in [c["name"] for c in cats if c["kind"] == "支出"]
    # 再讀一次不會重複建立
    assert len(client.get(f"{API}/accounting/categories", headers=h).json()) == len(cats)

    new = client.post(f"{API}/accounting/categories", json={"kind": "支出", "name": " 清潔 "}, headers=h)
    assert new.status_code == 201 and new.json()["name"] == "清潔" and new.json()["in_use"] is False
    assert client.post(f"{API}/accounting/categories", json={"kind": "支出", "name": "清潔"}, headers=h).status_code == 409
    # 同名但不同類型可以
    assert client.post(f"{API}/accounting/categories", json={"kind": "收入", "name": "清潔"}, headers=h).status_code == 201

    cid = new.json()["id"]
    assert entry(client, admin, "支出", "清潔", 500).status_code == 201
    assert client.delete(f"{API}/accounting/categories/{cid}", headers=h).status_code == 409
    off = client.put(f"{API}/accounting/categories/{cid}", json={"is_active": False}, headers=h).json()
    assert off["is_active"] is False and off["in_use"] is True
    # 停用的分類不能再新增帳目
    assert entry(client, admin, "支出", "清潔", 500).status_code == 400

    unused = next(c for c in cats if c["name"] == "設備維修")
    assert client.delete(f"{API}/accounting/categories/{unused['id']}", headers=h).status_code == 204


def test_entry_validation_edit_and_soft_delete(client, admin):
    h = auth(admin)
    rent = next(c for c in client.get(f"{API}/accounting/categories", headers=h).json() if c["name"] == "租金")
    wrong = {"kind": "收入", "category_id": rent["id"], "entry_date": "2030-01-10", "amount": 100, "payment_method": "現金"}
    assert client.post(f"{API}/accounting/entries", json=wrong, headers=h).status_code == 400  # 支出分類不能記收入
    assert entry(client, admin, "支出", "租金", 0).status_code == 422
    assert entry(client, admin, "支出", "租金", 100, payment_method="體驗券").status_code == 422
    assert entry(client, admin, "支出", "租金", 100, branch_id=999999).status_code == 400

    e = entry(client, admin, "支出", "租金", 20000, note=" 一月房租 ").json()
    assert e["note"] == "一月房租" and e["created_by_name"] == "admin" and e["category_name"] == "租金"
    body = {"kind": "支出", "category_id": e["category_id"], "entry_date": "2030-01-12", "amount": 21000,
            "payment_method": "轉帳"}
    updated = client.put(f"{API}/accounting/entries/{e['id']}", json=body, headers=h).json()
    assert updated["amount"] == 21000 and updated["payment_method"] == "轉帳" and updated["note"] is None
    assert report(client, admin)["expense"] == 21000

    deleted = client.delete(f"{API}/accounting/entries/{e['id']}", headers=h).json()
    assert deleted["deleted_at"] is not None and deleted["deleted_by_name"] == "admin"
    assert report(client, admin)["expense"] == 0
    assert client.put(f"{API}/accounting/entries/{e['id']}", json=body, headers=h).status_code == 400
    listed = client.get(f"{API}/accounting/entries", params=JAN, headers=h).json()
    assert listed == []
    listed = client.get(f"{API}/accounting/entries", params={**JAN, "include_deleted": True}, headers=h).json()
    assert [x["id"] for x in listed] == [e["id"]]


def test_trend_and_transactions(client, db, admin, member, pack):
    paid(db, member, pack, 1000, datetime(2030, 1, 5))
    paid(db, member, pack, 2000, datetime(2030, 2, 5))
    entry(client, admin, "支出", "租金", 500, day="2030-02-01")
    h = auth(admin)
    trend = client.get(f"{API}/accounting/trend", params={"months": 3}, headers=h).json()
    assert trend == [
        {"month": "2029-12", "income": 0, "expense": 0, "net": 0},
        {"month": "2030-01", "income": 1000, "expense": 0, "net": 1000},
        {"month": "2030-02", "income": 2000, "expense": 500, "net": 1500},
    ]
    rows = client.get(f"{API}/accounting/transactions",
                      params={"start": "2030-01-01", "end": "2030-02-28"}, headers=h).json()
    assert [(r["date"], r["source"], r["amount"]) for r in rows] == [
        ("2030-02-05", "sales", 2000), ("2030-02-01", "manual", 500), ("2030-01-05", "sales", 1000),
    ]
    only_expense = client.get(f"{API}/accounting/transactions",
                              params={"start": "2030-01-01", "end": "2030-02-28", "kind": "支出"}, headers=h).json()
    assert len(only_expense) == 1
    assert client.get(f"{API}/accounting/report", params={"start": "2030-01-01", "end": "2031-01-05"},
                      headers=h).status_code == 400
    assert client.get(f"{API}/accounting/report", params={"start": "2030-02-01", "end": "2030-01-01"},
                      headers=h).status_code == 400


# ---------- R60 權限與租戶隔離 ----------


def test_permission_and_isolation(client, beta_client, db, admin, beta_admin, member):
    desk = User(username="desk", password_hash=hash_password("pw"), role=UserRole.admin,
                staff_level=StaffLevel.staff, permissions=["purchases"])
    acct = User(username="acct", password_hash=hash_password("pw"), role=UserRole.admin,
                staff_level=StaffLevel.staff, permissions=["accounting"])
    db.add_all([desk, acct])
    db.commit()
    assert client.get(f"{API}/accounting/report", params=JAN, headers=auth(desk)).status_code == 403
    assert client.get(f"{API}/accounting/categories", headers=auth(member)).status_code == 403
    assert client.get(f"{API}/accounting/report", params=JAN, headers=auth(acct)).status_code == 200
    assert entry(client, acct, "支出", "租金", 100).status_code == 201

    meta = client.get(f"{API}/staff/meta", headers=auth(admin)).json()
    assert "accounting" in next(t for t in meta["templates"] if t["label"] == "會計")["codes"]

    # 另一家看不到
    assert beta_client.get(f"{API}/accounting/report", params=JAN, headers=auth(beta_admin)).json()["expense"] == 0
    assert beta_client.get(f"{API}/accounting/entries", params=JAN, headers=auth(beta_admin)).json() == []

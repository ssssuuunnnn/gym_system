"""
體驗券與折價券（ADR 0010、R43–R47）：建立與驗證、公開代碼折抵（伺服器計算金額）、
取消訂單退回、限制條件、後台發放與作廢、體驗券換堂數與預約、新會員限定與效期、
LINE 新加入與轉為會員自動發放、不計教練鐘點、權限與租戶隔離。
"""

from datetime import date, datetime

import pytest

from app.core import clock
from app.core.security import hash_password
from app.models.coach import Coach
from app.models.inquiry import Inquiry
from app.models.product import Product, ProductCategory
from app.models.purchase import Purchase
from app.models.reservation import Attendance, Reservation, ReservationSource, ReservationStatus
from app.models.user import StaffLevel, User, UserRole
from app.services import payouts
from tests.conftest import auth
from tests.test_line_oa import enabled, fake_oa, line_user  # noqa: F401  （共用 fixture）

API = "/api/v1"


@pytest.fixture(autouse=True)
def now(monkeypatch):
    """「現在」＝2030-01-10（工作室當地時間）。"""
    state = {"value": datetime(2030, 1, 10, 9, 0)}
    monkeypatch.setattr(clock, "now_local", lambda: state["value"])
    return lambda v: state.__setitem__("value", v)


@pytest.fixture()
def plan(db):
    p = Product(name="私人課 10 堂", category=ProductCategory.single_course, session_hours=10, price=12000)
    db.add(p)
    db.commit()
    return p


@pytest.fixture()
def trial_plan(db):
    """不上架販售的體驗課方案。"""
    p = Product(name="單堂體驗課", category=ProductCategory.single_course, session_hours=1, price=800, is_active=False)
    db.add(p)
    db.commit()
    return p


def make_user(db, username, role=UserRole.member, **extra):
    u = User(username=username, password_hash=hash_password("pw-123456"), role=role, **extra)
    db.add(u)
    db.commit()
    return u


def create(client, admin, **body):
    data = {"name": "新會員折 300", "kind": "折價券", "code": "welcome300", "discount_type": "折抵金額",
            "discount_value": 300, **body}
    return client.post(f"{API}/coupons", json=data, headers=auth(admin))


def trial(client, admin, trial_plan, **body):
    data = {"name": "免費體驗一堂", "kind": "體驗券", "code": None, "discount_type": None, "discount_value": None,
            "trial_product_id": trial_plan.id, **body}
    res = create(client, admin, **data)
    assert res.status_code == 201, res.text
    return res.json()


def buy(client, member, plan, **extra):
    return client.post(f"{API}/purchases/self", json={"product_id": plan.id, "quantity": 1, **extra}, headers=auth(member))


def mine(client, member):
    return client.get(f"{API}/coupons/mine", headers=auth(member)).json()


def test_create_and_validate(client, db, admin, member, plan, trial_plan):
    res = create(client, admin)
    assert res.status_code == 201, res.text
    c = res.json()
    assert c["code"] == "WELCOME300" and c["summary"] == "折 300 元" and c["issued_count"] == 0
    assert create(client, admin, name="重複").status_code == 409
    assert create(client, admin, code="bad code!").status_code == 422
    assert create(client, admin, code="P15", discount_type="折扣", discount_value=100).status_code == 422
    pct = create(client, admin, code="P15", discount_type="折扣", discount_value=15, min_amount=5000).json()
    assert pct["summary"] == "滿 5,000 元打 8.5 折"
    assert create(client, admin, kind="體驗券", code=None).status_code == 422  # 沒選方案
    supply = Product(name="毛巾", category=ProductCategory.supply, session_hours=0, price=100, stock=5)
    db.add(supply)
    db.commit()
    assert create(client, admin, kind="體驗券", code=None, trial_product_id=supply.id).status_code == 400
    t = trial(client, admin, trial_plan, counts_for_payout=False, issue_on_line_join=True, valid_days=14)
    assert t["summary"] == "送「單堂體驗課」1 堂" and t["counts_for_payout"] is False and t["discount_value"] is None

    # 權限：會員、沒有「優惠券」功能的一般使用者都不能管理
    assert client.get(f"{API}/coupons", headers=auth(member)).status_code == 403
    desk = make_user(db, "desk", UserRole.admin, staff_level=StaffLevel.staff, permissions=["purchases"])
    assert client.get(f"{API}/coupons", headers=auth(desk)).status_code == 403
    assert len(client.get(f"{API}/coupons", headers=auth(admin)).json()) == 3


def test_code_discount_is_computed_by_server_and_returned_on_cancel(client, db, admin, member, plan):
    create(client, admin)
    q = client.post(f"{API}/coupons/quote", json={"product_id": plan.id, "code": "welcome300"}, headers=auth(member))
    assert q.json() == {"original": 12000, "discount": 300, "final": 11700, "coupon_name": "新會員折 300",
                        "member_coupon_id": None}

    res = buy(client, member, plan, coupon_code="Welcome300")
    assert res.status_code == 201, res.text
    order = res.json()
    assert (order["amount"], order["original_amount"], order["discount_amount"]) == (11700, 12000, 300)
    assert order["coupon_name"] == "新會員折 300" and order["payment_status"] == "待付款"
    [mc] = mine(client, member)
    assert mc["status"] == "已使用" and mc["source"] == "輸入代碼" and mc["purchase_id"] == order["id"]
    # 每人一張：同一個代碼不能再用
    assert buy(client, member, plan, coupon_code="WELCOME300").json()["detail"] == "已經領過這張券了"

    # 取消待付款訂單 → 券退回，可以從「我的優惠券」再用
    assert client.post(f"{API}/purchases/{order['id']}/cancel", headers=auth(member)).status_code == 200
    [mc] = mine(client, member)
    assert mc["status"] == "可使用" and mc["purchase_id"] is None
    again = buy(client, member, plan, member_coupon_id=mc["id"])
    assert again.status_code == 201 and again.json()["amount"] == 11700
    # 別人的券不能用
    other = make_user(db, "other")
    assert buy(client, other, plan, member_coupon_id=mc["id"]).json()["detail"] == "找不到這張優惠券"
    assert buy(client, member, plan, coupon_code="NOPE").json()["detail"] == "找不到這個優惠代碼"


def test_percent_min_amount_scope_and_usable_list(client, db, admin, member, plan):
    cheap = Product(name="私人課 單堂", category=ProductCategory.single_course, session_hours=1, price=1300)
    db.add(cheap)
    db.commit()
    pct = create(client, admin, name="85 折", code="P15", discount_type="折扣", discount_value=15, min_amount=5000).json()
    only = create(client, admin, name="單堂限定", code=None, discount_value=200, product_ids=[cheap.id]).json()
    client.post(f"{API}/coupons/{pct['id']}/issue", json={"user_ids": [member.id]}, headers=auth(admin))
    client.post(f"{API}/coupons/{only['id']}/issue", json={"user_ids": [member.id]}, headers=auth(admin))

    usable = client.get(f"{API}/coupons/usable", params={"product_id": plan.id}, headers=auth(member)).json()
    assert [(u["member_coupon"]["name"], u["usable"], u["discount"]) for u in usable] == [
        ("85 折", True, 1800), ("單堂限定", False, 0)]
    assert usable[1]["reason"] == "這張券不適用這個方案"
    usable = client.get(f"{API}/coupons/usable", params={"product_id": cheap.id}, headers=auth(member)).json()
    assert [(u["member_coupon"]["name"], u["usable"]) for u in usable] == [("單堂限定", True), ("85 折", False)]
    assert usable[1]["reason"] == "滿 5,000 元才能使用"

    res = buy(client, member, plan, member_coupon_id=usable[1]["member_coupon"]["id"])
    assert res.json()["amount"] == 10200 and res.json()["discount_amount"] == 1800


def test_staff_issue_limits_void_and_edit_lock(client, db, admin, member, plan):
    c = create(client, admin, code=None, total_limit=1).json()
    member2 = make_user(db, "member2", display_name="林小芳")
    res = client.post(f"{API}/coupons/{c['id']}/issue", json={"user_ids": [member.id, member2.id, admin.id]},
                      headers=auth(admin)).json()
    assert res["issued"] == 1
    assert [(s["name"], s["reason"]) for s in res["skipped"]] == [("林小芳", "這張券已經發完了"), (f"#{admin.id}", "不是會員")]
    [mc] = mine(client, member)
    assert mc["source"] == "櫃台發放" and mc["issued_by_name"] == "admin"

    usage = client.get(f"{API}/coupons/{c['id']}/member-coupons", headers=auth(admin)).json()
    assert [u["member_name"] for u in usage] == ["member"]
    # 發出去之後不能改折扣，其他欄位可以
    body = {"name": "改名", "kind": "折價券", "discount_type": "折抵金額", "discount_value": 300, "total_limit": 2}
    assert client.put(f"{API}/coupons/{c['id']}", json=body, headers=auth(admin)).status_code == 200
    assert client.put(f"{API}/coupons/{c['id']}", json={**body, "discount_value": 500},
                      headers=auth(admin)).status_code == 400

    voided = client.post(f"{API}/coupons/member-coupons/{mc['id']}/void", json={"reason": "發錯人"}, headers=auth(admin))
    assert voided.json()["status"] == "已作廢" and mine(client, member) == []
    # 作廢的不算在總張數裡：可以再發給別人
    assert client.post(f"{API}/coupons/{c['id']}/issue", json={"user_ids": [member2.id]},
                       headers=auth(admin)).json()["issued"] == 1
    # 停用後不能再發、不能領
    client.put(f"{API}/coupons/{c['id']}", json={**body, "is_active": False}, headers=auth(admin))
    res = client.post(f"{API}/coupons/{c['id']}/issue", json={"user_ids": [member.id]}, headers=auth(admin)).json()
    assert res["skipped"][0]["reason"] == "這張券已停用"


def test_trial_voucher_gives_hours_for_booking(client, db, admin, member, trial_plan):
    t = trial(client, admin, trial_plan, code="TRY1")
    claimed = client.post(f"{API}/coupons/claim", json={"code": "try1"}, headers=auth(member))
    assert claimed.status_code == 201 and claimed.json()["kind"] == "體驗券"
    # 體驗券不能拿來折抵
    plan = Product(name="私人課 10 堂", category=ProductCategory.single_course, session_hours=10, price=12000)
    db.add(plan)
    db.commit()
    assert buy(client, member, plan, coupon_code="TRY1").json()["detail"] == "體驗券不能用來折抵，請到「我的優惠券」使用"

    res = client.post(f"{API}/coupons/mine/{claimed.json()['id']}/redeem", headers=auth(member))
    assert res.status_code == 201, res.text
    p = res.json()
    assert (p["amount"], p["payment_status"], p["payment_method"], p["remaining_hours"]) == (0, "已付款", "體驗券", 1)
    assert p["product_id"] == trial_plan.id and p["coupon_name"] == "免費體驗一堂"
    assert client.post(f"{API}/coupons/mine/{claimed.json()['id']}/redeem",
                       headers=auth(member)).json()["detail"] == "這張券已經用過了"

    # 用體驗券的堂數預約（方案沒上架也可以）
    body = {"member_id": member.id, "product_id": trial_plan.id, "purchase_id": p["id"], "booking_date": "2030-01-15",
            "start_hour": 10, "people_count": 1}
    booked = client.post(f"{API}/reservations", json=body, headers=auth(member))
    assert booked.status_code == 201, booked.text
    assert db.get(Purchase, p["id"]).remaining_hours == 0
    assert client.get(f"{API}/coupons", headers=auth(admin)).json()[0]["used_count"] == 1
    assert t["issued_count"] == 0


def test_new_member_only_and_expiry(client, db, admin, member, plan, trial_plan, now):
    t = trial(client, admin, trial_plan, new_member_only=True, valid_days=7)
    regular = make_user(db, "regular")
    db.add(Purchase(user_id=regular.id, product_id=plan.id, quantity=1, purchase_date=date(2029, 12, 1),
                    amount=12000, total_hours=10, remaining_hours=0, created_by=admin.id))
    db.commit()
    res = client.post(f"{API}/coupons/{t['id']}/issue", json={"user_ids": [member.id, regular.id]},
                      headers=auth(admin)).json()
    assert res["issued"] == 1 and res["skipped"][0]["reason"] == "這張券限新會員使用"
    [mc] = mine(client, member)
    assert mc["expires_on"] == "2030-01-16"

    now(datetime(2030, 1, 17, 9, 0))
    assert mine(client, member)[0]["status"] == "已過期"
    assert client.post(f"{API}/coupons/mine/{mc['id']}/redeem", headers=auth(member)).json()["detail"] == "這張券已經過期"


def test_line_join_and_convert_issue_trial(client, db, admin, enabled, trial_plan):  # noqa: F811
    t = trial(client, admin, trial_plan, issue_on_line_join=True)
    trial(client, admin, trial_plan, name="不自動發")
    line_user(enabled, "idtoken-new-user-9", "U-new-9", "小美")
    link_token = client.post(f"{API}/auth/line", json={"id_token": "idtoken-new-user-9"}).json()["link_token"]
    joined = client.post(f"{API}/auth/line/join", json={"link_token": link_token, "display_name": "陳小美",
                                                         "phone": "0912345678", "consent": True})
    assert joined.status_code == 201, joined.text
    headers = {"Authorization": f"Bearer {joined.json()['access_token']}"}
    [mc] = client.get(f"{API}/coupons/mine", headers=headers).json()
    assert mc["coupon_id"] == t["id"] and mc["source"] == "LINE 加入"

    inquiry = Inquiry(name="林小芳", phone="0922333444", consent_at=datetime.utcnow())
    db.add(inquiry)
    db.commit()
    options = client.get(f"{API}/coupons/options", params={"kind": "體驗券"}, headers=auth(admin)).json()
    assert [o["name"] for o in options] == ["不自動發", "免費體驗一堂"]
    res = client.post(f"{API}/inquiries/{inquiry.id}/convert", json={"username": "0922333444", "password": "init-pw-1",
                                                                      "coupon_id": t["id"]}, headers=auth(admin))
    assert res.status_code == 200, res.text
    new_user = db.query(User).filter(User.username == "0922333444").one()
    [mc] = mine(client, new_user)
    assert mc["source"] == "轉為會員" and mc["issued_by_name"] == "admin"
    assert "並送「免費體驗一堂」" in res.json()["notes"][0]["text"]


def test_trial_classes_can_be_excluded_from_coach_payouts(client, db, admin, member, trial_plan, now):
    coach_user = make_user(db, "coach")
    coach = Coach(user_id=coach_user.id, name="王教練", phone="0900", session_rate=800)
    db.add(coach)
    db.commit()
    unpaid = trial(client, admin, trial_plan, name="不計鐘點", counts_for_payout=False, per_member_limit=1)
    paid = trial(client, admin, trial_plan, name="照算鐘點")
    for c in (unpaid, paid):
        client.post(f"{API}/coupons/{c['id']}/issue", json={"user_ids": [member.id]}, headers=auth(admin))
    day_of = {"不計鐘點": 7, "照算鐘點": 8}
    for mc in mine(client, member):
        day = day_of[mc["name"]]
        p = client.post(f"{API}/coupons/mine/{mc['id']}/redeem", headers=auth(member)).json()
        db.add(Reservation(member_id=member.id, product_id=trial_plan.id, purchase_id=p["id"], coach_id=coach.id,
                           booking_date=date(2030, 1, day), start_hour=10, status=ReservationStatus.confirmed,
                           source=ReservationSource.admin_created, attendance=Attendance.attended))
    db.commit()
    units = payouts.billable_units(db, coach, date(2030, 1, 1))
    assert [u.session_date.day for u in units] == [8]  # 只有「照算鐘點」那一堂


def test_admin_purchase_with_coupon_ignores_entered_amount(client, db, admin, member, plan):
    c = create(client, admin, code=None).json()
    client.post(f"{API}/coupons/{c['id']}/issue", json={"user_ids": [member.id]}, headers=auth(admin))
    [mc] = mine(client, member)
    usable = client.get(f"{API}/coupons/usable", params={"product_id": plan.id, "user_id": member.id},
                        headers=auth(admin)).json()
    assert usable[0]["final"] == 11700
    body = {"user_id": member.id, "product_id": plan.id, "quantity": 1, "purchase_date": "2030-01-10",
            "amount": 1, "payment_method": "現金", "member_coupon_id": mc["id"]}
    res = client.post(f"{API}/purchases", json=body, headers=auth(admin))
    assert res.status_code == 201, res.text
    assert (res.json()["amount"], res.json()["payment_status"], res.json()["remaining_hours"]) == (11700, "已付款", 10)


def test_tenant_isolation(client, beta_client, beta_db, admin, beta_admin, plan):
    create(client, admin)
    assert beta_client.get(f"{API}/coupons", headers=auth(beta_admin)).json() == []
    beta_member = make_user(beta_db, "bm")
    res = beta_client.post(f"{API}/coupons/claim", json={"code": "WELCOME300"}, headers=auth(beta_member))
    assert res.status_code == 400 and res.json()["detail"] == "找不到這個優惠代碼"

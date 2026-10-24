"""堂數帳務：購買入帳、預約扣抵、拒絕／取消退回、手動調整，以及帳目一致性。"""

from sqlalchemy import func

from app.models.hour_ledger import HourLedger
from app.models.purchase import Purchase
from tests.conftest import auth

API = "/api/v1"


def buy(client, admin, member, product, quantity=1):
    res = client.post(
        f"{API}/purchases",
        json={
            "user_id": member.id,
            "product_id": product.id,
            "quantity": quantity,
            "purchase_date": "2026-10-01",
            "amount": 10000,
        },
        headers=auth(admin),
    )
    assert res.status_code == 201, res.text
    return res.json()


def book(client, user, product, purchase_id, *, hour=10, as_admin=False, member_id=None):
    res = client.post(
        f"{API}/reservations" + ("?as_admin=true" if as_admin else ""),
        json={
            "member_id": member_id or user.id,
            "product_id": product.id,
            "purchase_id": purchase_id,
            "booking_date": "2030-01-07",
            "start_hour": hour,
        },
        headers=auth(user),
    )
    return res


def remaining(client, user, purchase_id) -> float:
    rows = client.get(f"{API}/purchases", headers=auth(user)).json()
    return next(p["remaining_hours"] for p in rows if p["id"] == purchase_id)


def assert_books_balance(db):
    """每筆購買紀錄的 SUM(ledger.delta) 必須等於 remaining_hours。"""
    db.expire_all()
    for purchase in db.query(Purchase).all():
        total = (
            db.query(func.coalesce(func.sum(HourLedger.delta), 0))
            .filter(HourLedger.purchase_id == purchase.id)
            .scalar()
        )
        assert float(total) == float(purchase.remaining_hours), purchase.id


# ── 購買 ──────────────────────────────────────────────


def test_purchase_writes_ledger_entry(client, db, admin, member, pack):
    p = buy(client, admin, member, pack, quantity=2)
    assert p["remaining_hours"] == 20

    ledger = client.get(f"{API}/purchases/{p['id']}/ledger", headers=auth(member)).json()
    assert [(e["reason"], e["delta"], e["balance_after"]) for e in ledger] == [("購買", 20, 20)]
    assert_books_balance(db)


def test_supply_purchase_has_no_ledger(client, db, admin, member, supply):
    p = buy(client, admin, member, supply)
    assert client.get(f"{API}/purchases/{p['id']}/ledger", headers=auth(admin)).json() == []


# ── 預約扣抵 ──────────────────────────────────────────


def test_member_booking_deducts_one_hour(client, db, admin, member, pack):
    p = buy(client, admin, member, pack)
    res = book(client, member, pack, p["id"])
    assert res.status_code == 201, res.text
    assert remaining(client, member, p["id"]) == 9
    assert_books_balance(db)


def test_booking_without_purchase_does_not_deduct(client, db, admin, member, pack):
    p = buy(client, admin, member, pack)
    assert book(client, member, pack, None).status_code == 201
    assert remaining(client, member, p["id"]) == 10


def test_cannot_book_when_hours_run_out_and_nothing_is_saved(client, db, admin, member, pack, monkeypatch):
    p = buy(client, admin, member, pack)
    client.post(
        f"{API}/purchases/{p['id']}/adjust", json={"change": -10, "note": "測試歸零"}, headers=auth(admin)
    )
    res = book(client, member, pack, p["id"])
    assert res.status_code == 400
    assert res.json()["detail"] == "剩餘堂數不足"
    # 交易回滾：不留下沒扣到堂數的預約
    assert client.get(f"{API}/reservations", headers=auth(member)).json() == []
    assert_books_balance(db)


def test_cannot_use_someone_elses_purchase(client, admin, member, other_member, pack):
    p = buy(client, admin, other_member, pack)
    res = book(client, member, pack, p["id"])
    assert res.status_code == 400
    assert res.json()["detail"] == "購買紀錄不屬於該會員"
    assert remaining(client, admin, p["id"]) == 10


def test_purchase_must_match_booked_product(client, db, admin, member, pack):
    from app.models.product import Product, ProductCategory

    other = Product(name="團課 8 堂", category=ProductCategory.single_course, session_hours=8, price=4000)
    db.add(other)
    db.commit()
    p = buy(client, admin, member, pack)
    res = book(client, member, other, p["id"])
    assert res.status_code == 400
    assert res.json()["detail"] == "購買紀錄的商品與預約商品不符"


def test_admin_created_booking_also_deducts(client, db, admin, member, pack):
    p = buy(client, admin, member, pack)
    res = book(client, admin, pack, p["id"], as_admin=True, member_id=member.id)
    assert res.status_code == 201, res.text
    assert res.json()["status"] == "已確認"
    assert remaining(client, member, p["id"]) == 9


# ── 退回 ──────────────────────────────────────────────


def test_cancel_refunds_exactly_one_hour(client, db, admin, member, pack):
    """修正前：取消會退回整個方案的堂數（+10），且建立時根本沒扣。"""
    p = buy(client, admin, member, pack)
    r = book(client, member, pack, p["id"]).json()
    assert client.post(f"{API}/reservations/{r['id']}/cancel", headers=auth(member)).status_code == 200
    assert remaining(client, member, p["id"]) == 10

    reasons = [e["reason"] for e in client.get(f"{API}/purchases/{p['id']}/ledger", headers=auth(member)).json()]
    assert reasons == ["購買", "預約扣抵", "預約退回"]
    assert_books_balance(db)


def test_repeated_booking_and_cancel_never_inflates_hours(client, db, admin, member, pack):
    p = buy(client, admin, member, pack)
    for hour in range(10, 15):
        r = book(client, member, pack, p["id"], hour=hour).json()
        client.post(f"{API}/reservations/{r['id']}/cancel", headers=auth(member))
    assert remaining(client, member, p["id"]) == 10
    assert_books_balance(db)


def test_reject_refunds(client, db, admin, member, pack):
    p = buy(client, admin, member, pack)
    r = book(client, member, pack, p["id"]).json()
    res = client.post(f"{API}/reservations/{r['id']}/review", json={"status": "已拒絕"}, headers=auth(admin))
    assert res.status_code == 200, res.text
    assert res.json()["reviewed_by"] == admin.id
    assert remaining(client, member, p["id"]) == 10
    assert_books_balance(db)


def test_confirm_keeps_deduction(client, db, admin, member, pack):
    p = buy(client, admin, member, pack)
    r = book(client, member, pack, p["id"]).json()
    client.post(f"{API}/reservations/{r['id']}/review", json={"status": "已確認"}, headers=auth(admin))
    assert remaining(client, member, p["id"]) == 9


def test_cannot_review_a_cancelled_reservation(client, admin, member, pack):
    """修正前：已取消（已退堂）的預約仍可被核准，變成免費上課。"""
    p = buy(client, admin, member, pack)
    r = book(client, member, pack, p["id"]).json()
    client.post(f"{API}/reservations/{r['id']}/cancel", headers=auth(member))
    res = client.post(f"{API}/reservations/{r['id']}/review", json={"status": "已確認"}, headers=auth(admin))
    assert res.status_code == 400
    assert remaining(client, member, p["id"]) == 10


def test_cancel_after_reject_does_not_refund_twice(client, db, admin, member, pack):
    p = buy(client, admin, member, pack)
    r = book(client, member, pack, p["id"]).json()
    client.post(f"{API}/reservations/{r['id']}/review", json={"status": "已拒絕"}, headers=auth(admin))
    # 已拒絕不可再取消（既有規則），即使呼叫也不會多退
    assert client.post(f"{API}/reservations/{r['id']}/cancel", headers=auth(admin)).status_code == 400
    assert remaining(client, member, p["id"]) == 10
    assert_books_balance(db)


# ── 手動調整 ──────────────────────────────────────────


def test_admin_adjust_with_note(client, db, admin, member, pack):
    p = buy(client, admin, member, pack)
    res = client.post(
        f"{API}/purchases/{p['id']}/adjust", json={"change": 2, "note": "補登贈送堂數"}, headers=auth(admin)
    )
    assert res.status_code == 201, res.text
    assert res.json()["balance_after"] == 12
    assert_books_balance(db)


def test_adjust_cannot_go_negative(client, admin, member, pack):
    p = buy(client, admin, member, pack)
    res = client.post(f"{API}/purchases/{p['id']}/adjust", json={"change": -11, "note": "x"}, headers=auth(admin))
    assert res.status_code == 400
    assert remaining(client, admin, p["id"]) == 10


def test_adjust_requires_note_and_admin(client, admin, member, pack):
    p = buy(client, admin, member, pack)
    url = f"{API}/purchases/{p['id']}/adjust"
    assert client.post(url, json={"change": 1, "note": ""}, headers=auth(admin)).status_code == 422
    assert client.post(url, json={"change": 0, "note": "x"}, headers=auth(admin)).status_code == 422
    assert client.post(url, json={"change": 5, "note": "x"}, headers=auth(member)).status_code == 403


def test_member_cannot_read_others_ledger(client, admin, member, other_member, pack):
    p = buy(client, admin, other_member, pack)
    assert client.get(f"{API}/purchases/{p['id']}/ledger", headers=auth(member)).status_code == 404

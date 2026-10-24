"""購買付款狀態：會員自助購買為待付款、確認收款才入帳、取消歸還庫存、未付款不可扣抵。"""

from tests.conftest import auth
from tests.test_hour_ledger import API, assert_books_balance, book, buy


def self_buy(client, member, product, quantity=1):
    res = client.post(
        f"{API}/purchases/self", json={"product_id": product.id, "quantity": quantity}, headers=auth(member)
    )
    assert res.status_code == 201, res.text
    return res.json()


def confirm(client, admin, purchase_id, method="現金", note=None):
    return client.post(
        f"{API}/purchases/{purchase_id}/confirm-payment",
        json={"payment_method": method, "payment_note": note},
        headers=auth(admin),
    )


def test_self_purchase_starts_unpaid_without_hours(client, db, member, pack):
    p = self_buy(client, member, pack, quantity=2)
    assert p["payment_status"] == "待付款"
    assert p["total_hours"] == 20
    assert p["remaining_hours"] == 0
    assert p["paid_at"] is None
    assert client.get(f"{API}/purchases/{p['id']}/ledger", headers=auth(member)).json() == []


def test_admin_entry_is_paid_immediately(client, db, admin, member, pack):
    p = buy(client, admin, member, pack)
    assert p["payment_status"] == "已付款"
    assert p["paid_confirmed_by"] == admin.id
    assert p["remaining_hours"] == 10


def test_confirm_payment_credits_hours(client, db, admin, member, pack):
    p = self_buy(client, member, pack)
    res = confirm(client, admin, p["id"], method="轉帳", note="末五碼 12345")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["payment_status"] == "已付款"
    assert body["payment_method"] == "轉帳"
    assert body["payment_note"] == "末五碼 12345"
    assert body["paid_confirmed_by"] == admin.id
    assert body["remaining_hours"] == 10
    ledger = client.get(f"{API}/purchases/{p['id']}/ledger", headers=auth(member)).json()
    assert [(e["reason"], e["delta"]) for e in ledger] == [("購買", 10)]
    assert_books_balance(db)


def test_confirm_uses_hours_at_order_time(client, db, admin, member, pack):
    """下單後商品堂數被改動，確認收款仍依下單時的堂數入帳。"""
    p = self_buy(client, member, pack)
    pack.session_hours = 5
    db.commit()
    assert confirm(client, admin, p["id"]).json()["remaining_hours"] == 10


def test_cannot_confirm_twice(client, db, admin, member, pack):
    p = self_buy(client, member, pack)
    confirm(client, admin, p["id"])
    res = confirm(client, admin, p["id"])
    assert res.status_code == 400
    assert client.get(f"{API}/purchases", headers=auth(member)).json()[0]["remaining_hours"] == 10
    assert_books_balance(db)


def test_only_admin_can_confirm(client, member, pack):
    p = self_buy(client, member, pack)
    assert confirm(client, member, p["id"]).status_code == 403


def test_confirm_requires_payment_method(client, admin, member, pack):
    p = self_buy(client, member, pack)
    res = client.post(f"{API}/purchases/{p['id']}/confirm-payment", json={}, headers=auth(admin))
    assert res.status_code == 422


def test_unpaid_purchase_cannot_be_used_for_booking(client, db, member, pack):
    p = self_buy(client, member, pack)
    res = book(client, member, pack, p["id"])
    assert res.status_code == 400
    assert res.json()["detail"] == "購買紀錄尚未付款，無法扣抵"
    assert client.get(f"{API}/reservations", headers=auth(member)).json() == []


def test_member_can_cancel_own_unpaid_order(client, member, pack):
    p = self_buy(client, member, pack)
    res = client.post(f"{API}/purchases/{p['id']}/cancel", headers=auth(member))
    assert res.status_code == 200, res.text
    assert res.json()["payment_status"] == "已取消"
    assert res.json()["cancelled_at"] is not None


def test_member_cannot_cancel_others_order(client, member, other_member, pack):
    p = self_buy(client, other_member, pack)
    assert client.post(f"{API}/purchases/{p['id']}/cancel", headers=auth(member)).status_code == 404


def test_cannot_cancel_paid_order(client, admin, member, pack):
    p = buy(client, admin, member, pack)
    res = client.post(f"{API}/purchases/{p['id']}/cancel", headers=auth(admin))
    assert res.status_code == 400
    assert res.json()["detail"] == "僅待付款的訂單可取消"


def test_cannot_confirm_cancelled_order(client, admin, member, pack):
    p = self_buy(client, member, pack)
    client.post(f"{API}/purchases/{p['id']}/cancel", headers=auth(member))
    assert confirm(client, admin, p["id"]).status_code == 400


def test_supply_stock_reserved_on_order_and_returned_on_cancel(client, db, admin, member, supply):
    p = self_buy(client, member, supply, quantity=2)
    db.refresh(supply)
    assert supply.stock == 3
    client.post(f"{API}/purchases/{p['id']}/cancel", headers=auth(admin))
    db.refresh(supply)
    assert supply.stock == 5


def test_supply_confirm_keeps_stock_deducted(client, db, admin, member, supply):
    p = self_buy(client, member, supply, quantity=2)
    assert confirm(client, admin, p["id"]).status_code == 200
    db.refresh(supply)
    assert supply.stock == 3


def test_cannot_adjust_unpaid_purchase(client, admin, member, pack):
    p = self_buy(client, member, pack)
    res = client.post(f"{API}/purchases/{p['id']}/adjust", json={"change": 1, "note": "x"}, headers=auth(admin))
    assert res.status_code == 400


def test_filter_by_payment_status(client, admin, member, pack):
    unpaid = self_buy(client, member, pack)
    buy(client, admin, member, pack)
    rows = client.get(f"{API}/purchases", params={"payment_status": "待付款"}, headers=auth(admin)).json()
    assert [r["id"] for r in rows] == [unpaid["id"]]

"""
後台鈴鐺通知（ADR 0009、R40–R42）：會員送出預約、自己取消預約、下單待付款、網站體驗詢問時，
通知有對應功能權限的後台帳號；已讀未讀各自記；不放電話；權限被拿掉就看不到；租戶隔離。
"""

from datetime import datetime, timedelta

import pytest

from app.core.security import hash_password
from app.models.product import Product, ProductCategory
from app.models.staff_notification import StaffNotification
from app.models.user import StaffLevel, User, UserRole
from tests.conftest import auth

API = "/api/v1"


@pytest.fixture()
def plan(db):
    p = Product(name="私人課 10 堂", category=ProductCategory.single_course, session_hours=10, price=12000)
    db.add(p)
    db.commit()
    return p


def staff(db, username, perms, *, active=True):
    u = User(username=username, password_hash=hash_password("pw-123456"), role=UserRole.admin,
             staff_level=StaffLevel.staff, permissions=perms, is_active=active)
    db.add(u)
    db.commit()
    return u


def book(client, member, plan, **extra):
    body = {"member_id": member.id, "product_id": plan.id, "booking_date": "2030-01-02", "start_hour": 10,
            "people_count": 1, **extra}
    res = client.post(f"{API}/reservations", json=body, headers=auth(member))
    assert res.status_code == 201, res.text
    return res.json()


def items(client, user, **params):
    res = client.get(f"{API}/notifications", params=params, headers=auth(user))
    assert res.status_code == 200, res.text
    return res.json()["items"]


def test_member_booking_notifies_staff_with_permission(client, db, admin, member, plan):
    member.display_name = "王小明"
    member.phone = "0912345678"
    db.commit()
    desk = staff(db, "desk", ["reservations"])
    accountant = staff(db, "acct", ["purchases"])
    staff(db, "gone", ["reservations"], active=False)

    r = book(client, member, plan)
    [n] = items(client, desk)
    assert n["kind"] == "新預約" and n["title"] == "新的預約，等待審核"
    assert n["body"] == "王小明・1/2（三）10:00・私人課 10 堂"
    assert n["link"] == f"/admin/reservations?highlight={r['id']}"
    assert "0912" not in n["body"] and n["read_at"] is None
    assert len(items(client, admin)) == 1  # 舊資料的管理員＝管理者，全部功能
    assert items(client, accountant) == []  # 沒有預約審核
    assert db.query(StaffNotification).count() == 2  # 停用的帳號不收

    # 管理員自己建立的預約不通知
    body = {"member_id": member.id, "product_id": plan.id, "booking_date": "2030-01-03", "start_hour": 11, "people_count": 1}
    assert client.post(f"{API}/reservations", params={"as_admin": True}, json=body, headers=auth(admin)).status_code == 201
    assert len(items(client, desk)) == 1


def test_member_cancel_notifies_but_staff_cancel_does_not(client, db, admin, member, plan):
    desk = staff(db, "desk", ["reservations"])
    first = book(client, member, plan)
    second = book(client, member, plan, start_hour=11)
    assert client.post(f"{API}/reservations/{first['id']}/cancel", headers=auth(member)).status_code == 200
    assert client.post(f"{API}/reservations/{second['id']}/cancel", headers=auth(admin)).status_code == 200
    kinds = [n["kind"] for n in items(client, desk)]
    assert kinds == ["會員取消預約", "新預約", "新預約"]


def test_order_and_inquiry(client, db, admin, member, plan):
    acct = staff(db, "acct", ["purchases"])
    sales = staff(db, "sales", ["inquiries"])
    res = client.post(f"{API}/purchases/self", json={"product_id": plan.id, "quantity": 2}, headers=auth(member))
    [n] = items(client, acct)
    assert n["kind"] == "新訂單" and n["body"] == "member・私人課 10 堂 × 2・NT$ 24,000"
    assert n["link"] == f"/admin/purchases?highlight={res.json()['id']}"

    client.get(f"{API}/website", headers=auth(admin))
    client.post(f"{API}/website/publish", headers=auth(admin))
    form = {"name": "陳小美", "phone": "0912-345-678", "interest": "私人教練課", "slot": "平日晚上", "consent": "on"}
    assert client.post("/site/inquiry", data=form, follow_redirects=False).status_code == 303
    [n] = items(client, sales)
    assert n["kind"] == "新詢問" and n["body"] == "陳小美・想體驗 私人教練課・平日晚上"
    assert n["link"].startswith("/admin/inquiries?highlight=") and "0912" not in n["body"]
    assert [x["kind"] for x in items(client, admin)] == ["新詢問", "新訂單"]


def test_read_unread_and_read_all(client, db, admin, member, plan):
    desk = staff(db, "desk", ["reservations"])
    for hour in (10, 11, 12):
        book(client, member, plan, start_hour=hour)
    summary = client.get(f"{API}/notifications/summary", headers=auth(desk)).json()
    assert summary["unread_count"] == 3 and summary["new"] == []
    latest = summary["latest_id"]

    newest, middle, oldest = items(client, desk)
    assert client.post(f"{API}/notifications/{middle['id']}/read", headers=auth(desk)).json()["read_at"]
    assert [n["id"] for n in items(client, desk, unread_only=True)] == [newest["id"], oldest["id"]]
    # 每人的已讀各自記
    assert client.get(f"{API}/notifications/summary", headers=auth(admin)).json()["unread_count"] == 3
    # 別人的通知讀不到
    other = items(client, admin)[0]
    assert client.post(f"{API}/notifications/{other['id']}/read", headers=auth(desk)).status_code == 404

    # 輪詢：after_id 之後的新通知
    book(client, member, plan, start_hour=13)
    summary = client.get(f"{API}/notifications/summary", params={"after_id": latest}, headers=auth(desk)).json()
    assert summary["unread_count"] == 3 and len(summary["new"]) == 1 and summary["latest_id"] > latest

    assert client.post(f"{API}/notifications/read-all", headers=auth(desk)).status_code == 204
    assert client.get(f"{API}/notifications/summary", headers=auth(desk)).json()["unread_count"] == 0
    assert client.get(f"{API}/notifications/summary", headers=auth(admin)).json()["unread_count"] == 4


def test_paging_permission_filter_and_purge(client, db, member, plan):
    desk = staff(db, "desk", ["reservations"])
    for hour in range(10, 15):
        book(client, member, plan, start_hour=hour)
    page = client.get(f"{API}/notifications", params={"limit": 3}, headers=auth(desk)).json()
    assert len(page["items"]) == 3 and page["has_more"] is True
    rest = client.get(f"{API}/notifications", params={"limit": 3, "before_id": page["items"][-1]["id"]},
                      headers=auth(desk)).json()
    assert len(rest["items"]) == 2 and rest["has_more"] is False

    # 權限被拿掉：舊通知也看不到
    desk.permissions = ["purchases"]
    db.commit()
    assert items(client, desk) == []
    assert client.get(f"{API}/notifications/summary", headers=auth(desk)).json()["unread_count"] == 0

    # 超過 90 天自動清掉
    desk.permissions = ["reservations"]
    db.query(StaffNotification).update({StaffNotification.created_at: datetime.utcnow() - timedelta(days=91)})
    db.commit()
    assert items(client, desk) == []
    assert db.query(StaffNotification).count() == 0


def test_members_cannot_use_and_tenants_are_isolated(client, beta_client, db, member, beta_admin, plan):
    book(client, member, plan)
    assert client.get(f"{API}/notifications/summary", headers=auth(member)).status_code == 403
    assert beta_client.get(f"{API}/notifications", headers=auth(beta_admin)).json()["items"] == []

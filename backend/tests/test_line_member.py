"""
健身房官方帳號推播給會員（ADR 0005 第二階段）：預約結果、櫃台取消、收款、上課提醒，
以及各項開關、會員自己關閉、每月上限、重試與額度用完、紀錄與權限。
"""

import json
from datetime import date, datetime, timedelta

import pytest

from app.core import clock
from app.models.line import LineNotificationStatus
from app.models.line_oa import LineMemberMessage
from app.models.product import Product, ProductCategory
from app.models.purchase import PaymentMethod, PaymentStatus, Purchase
from app.models.reservation import Reservation, ReservationSource, ReservationStatus
from app.services import hours
from app.services import line_member
from app.services.line import LineApiError
from tests.conftest import auth
from tests.test_line_oa import LIFF_ID, enabled, fake_oa  # noqa: F401  （共用 fixture）

API = "/api/v1"
BOOK_DATE = "2030-01-02"


@pytest.fixture()
def pushes(monkeypatch, enabled):  # noqa: F811
    """把「回應後推播」改成測試呼叫 run() 才發送（理由同 test_line.fake_line）。"""
    from app.core.tenant_context import current_tenant

    scheduled = []

    def schedule(background_tasks, message_id):
        if message_id is not None:
            scheduled.append((current_tenant.get().id, message_id))

    def run():
        while scheduled:
            tenant_id, message_id = scheduled.pop(0)
            line_member.dispatch_tenant(tenant_id, [message_id])
        return enabled.pushes

    monkeypatch.setattr(line_member, "schedule", schedule)
    enabled.run = run
    return enabled


@pytest.fixture()
def linked(member, db):
    member.line_user_id = "U-member"
    member.display_name = "王小明"
    db.commit()
    return member


@pytest.fixture()
def plan(db):
    p = Product(name="私人課 10 堂", category=ProductCategory.single_course, session_hours=10, price=12000)
    db.add(p)
    db.commit()
    return p


def alt(push) -> str:
    return push[1][0]["altText"]


def card(push) -> str:
    return json.dumps(push[1][0], ensure_ascii=False)


def messages(db) -> list[LineMemberMessage]:
    db.expire_all()
    return db.query(LineMemberMessage).order_by(LineMemberMessage.id).all()


def submit(client, member, plan, **extra):
    body = {"member_id": member.id, "product_id": plan.id, "booking_date": BOOK_DATE, "start_hour": 10,
            "people_count": 1, **extra}
    res = client.post(f"{API}/reservations", json=body, headers=auth(member))
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_review_results(client, admin, linked, db, plan, pushes):
    first = submit(client, linked, plan)
    assert pushes.run() == []  # 會員自己送出：不發
    client.post(f"{API}/reservations/{first}/review", json={"status": "已確認"}, headers=auth(admin))
    sent = pushes.run()
    assert len(sent) == 1 and sent[0][0] == "U-member"
    assert "預約成功" in alt(sent[0])
    assert "私人課 10 堂" in card(sent[0]) and "1/2（三） 10:00" in card(sent[0])
    assert f"https://liff.line.me/{LIFF_ID}/bookings" in card(sent[0])

    second = submit(client, linked, plan, start_hour=11)
    client.post(f"{API}/reservations/{second}/review", json={"status": "已拒絕"}, headers=auth(admin))
    sent = pushes.run()
    assert "預約未成立" in alt(sent[-1]) and f"https://liff.line.me/{LIFF_ID}/book\"" in card(sent[-1])
    # 送出後清掉內容，只留結果
    rows = messages(db)
    assert [m.status for m in rows] == [LineNotificationStatus.sent] * 2
    assert all(m.message is None for m in rows)


def test_admin_booking_and_cancel(client, admin, linked, db, plan, pushes):
    body = {"member_id": linked.id, "product_id": plan.id, "booking_date": BOOK_DATE, "start_hour": 10, "people_count": 1}
    rid = client.post(f"{API}/reservations", params={"as_admin": True}, json=body, headers=auth(admin)).json()["id"]
    assert "櫃台已為你預約" in alt(pushes.run()[-1])
    client.post(f"{API}/reservations/{rid}/cancel", headers=auth(admin))
    assert "預約已取消" in alt(pushes.run()[-1])
    # 會員自己取消：不發
    own = submit(client, linked, plan, start_hour=12)
    client.post(f"{API}/reservations/{own}/cancel", headers=auth(linked))
    assert len(pushes.run()) == 2


def test_cancel_shows_refund(client, admin, linked, db, plan, pushes):
    purchase = Purchase(user_id=linked.id, product_id=plan.id, quantity=1, purchase_date=date(2026, 1, 1), amount=12000,
                        total_hours=10, remaining_hours=0, payment_status=PaymentStatus.paid,
                        payment_method=PaymentMethod.cash, created_by=admin.id)
    db.add(purchase)
    db.flush()
    hours.record_purchase(db, purchase, created_by=admin.id)
    db.commit()
    rid = submit(client, linked, plan, purchase_id=purchase.id)
    client.post(f"{API}/reservations/{rid}/cancel", headers=auth(admin))
    assert "已退回" in card(pushes.run()[-1])


def test_payment_confirmed(client, admin, linked, db, plan, pushes):
    pid = client.post(f"{API}/purchases/self", json={"product_id": plan.id, "quantity": 2}, headers=auth(linked)).json()["id"]
    assert pushes.run() == []  # 會員自己下單：不發
    client.post(f"{API}/purchases/{pid}/confirm-payment", json={"payment_method": "轉帳"}, headers=auth(admin))
    sent = pushes.run()
    assert "已收到款項" in alt(sent[-1])
    text = card(sent[-1])
    assert "私人課 10 堂 × 2" in text and "NT$ 24,000" in text and "已入帳 20 堂" in text
    assert f"https://liff.line.me/{LIFF_ID}/book\"" in text and "去預約課程" in text


def test_switches_optout_and_unlinked(client, admin, linked, other_member, db, plan, pushes):
    headers = auth(admin)
    res = client.patch(f"{API}/line-oa/notifications", json={"notify_booking_result": False}, headers=headers)
    assert res.json()["notify_booking_result"] is False
    rid = submit(client, linked, plan)
    client.post(f"{API}/reservations/{rid}/review", json={"status": "已確認"}, headers=headers)
    assert pushes.run() == [] and messages(db) == []

    client.patch(f"{API}/line-oa/notifications", json={"notify_booking_result": True}, headers=headers)
    # 會員自己關閉通知
    pref = client.patch(f"{API}/auth/line/preferences", json={"line_notify": False}, headers=auth(linked))
    assert pref.json()["line_notify"] is False
    rid = submit(client, linked, plan, start_hour=11)
    client.post(f"{API}/reservations/{rid}/review", json={"status": "已確認"}, headers=headers)
    assert pushes.run() == []
    # 沒綁 LINE 的會員
    rid = submit(client, other_member, plan, start_hour=12)
    client.post(f"{API}/reservations/{rid}/review", json={"status": "已確認"}, headers=headers)
    assert pushes.run() == [] and messages(db) == []
    # 官方帳號停用
    client.patch(f"{API}/auth/line/preferences", json={"line_notify": True}, headers=auth(linked))
    client.post(f"{API}/line-oa/disable", headers=headers)
    rid = submit(client, linked, plan, start_hour=13)
    client.post(f"{API}/reservations/{rid}/review", json={"status": "已確認"}, headers=headers)
    assert pushes.run() == [] and messages(db) == []


def test_monthly_cap(client, admin, linked, db, plan, pushes):
    client.patch(f"{API}/line-oa/notifications", json={"member_monthly_cap": 1}, headers=auth(admin))
    for hour in (10, 11):
        rid = submit(client, linked, plan, start_hour=hour)
        client.post(f"{API}/reservations/{rid}/review", json={"status": "已確認"}, headers=auth(admin))
    assert len(pushes.run()) == 1
    rows = messages(db)
    assert rows[1].status == LineNotificationStatus.skipped_cap and "上限 1 則" in rows[1].note
    out = client.get(f"{API}/line-oa", headers=auth(admin)).json()
    assert out["member_sent_this_month"] == 1 and out["member_monthly_cap"] == 1
    # 送 null＝不限制
    assert client.patch(f"{API}/line-oa/notifications", json={"member_monthly_cap": None},
                        headers=auth(admin)).json()["member_monthly_cap"] is None


def test_retry_and_quota_exhausted(client, admin, linked, db, plan, pushes):
    pushes.push_error = LineApiError(500, "Internal error")
    rid = submit(client, linked, plan)
    client.post(f"{API}/reservations/{rid}/review", json={"status": "已確認"}, headers=auth(admin))
    pushes.run()
    row = messages(db)[0]
    assert row.status == LineNotificationStatus.retrying and row.message is not None and "1 分鐘後重試" in row.note

    pushes.push_error = LineApiError(429, "You have reached your monthly limit.")
    rid = submit(client, linked, plan, start_hour=11)
    client.post(f"{API}/reservations/{rid}/review", json={"status": "已確認"}, headers=auth(admin))
    pushes.run()
    row = messages(db)[1]
    assert row.status == LineNotificationStatus.failed and "本月訊息額度" in row.note


@pytest.fixture()
def at(monkeypatch):
    state = {"value": datetime(2030, 1, 1, 20, 5)}
    monkeypatch.setattr(clock, "now_local", lambda: state["value"])
    return state


def add_confirmed(db, member, plan, day, hour):
    db.add(Reservation(member_id=member.id, product_id=plan.id, booking_date=day, start_hour=hour, people_count=1,
                       status=ReservationStatus.confirmed, source=ReservationSource.admin_created))
    db.commit()


def test_class_reminders(client, admin, linked, other_member, db, plan, pushes, at, tenants):
    tomorrow = date(2030, 1, 2)
    add_confirmed(db, linked, plan, tomorrow, 19)
    add_confirmed(db, linked, plan, tomorrow, 10)
    add_confirmed(db, other_member, plan, tomorrow, 10)  # 沒綁 LINE
    add_confirmed(db, linked, plan, date(2030, 1, 3), 10)  # 後天

    at["value"] = datetime(2030, 1, 1, 19, 59)  # 還沒到提醒時間
    line_member.dispatch_tenant(tenants["alpha"], with_reminders=True)
    assert pushes.pushes == []

    at["value"] = datetime(2030, 1, 1, 20, 5)
    line_member.dispatch_tenant(tenants["alpha"], with_reminders=True)
    assert len(pushes.pushes) == 1
    text = card(pushes.pushes[0])
    assert "明天的課程提醒" in alt(pushes.pushes[0])
    assert "明天 1/2（三）" in text and text.index("10:00") < text.index("19:00")
    # 同一天只提醒一次
    line_member.dispatch_tenant(tenants["alpha"], with_reminders=True)
    assert len(pushes.pushes) == 1
    # 過了提醒時段不再產生（例如 23 點才確認的預約）
    at["value"] = datetime(2030, 1, 2, 23, 0)
    line_member.dispatch_tenant(tenants["alpha"], with_reminders=True)
    assert len(pushes.pushes) == 1
    # 關閉提醒
    client.patch(f"{API}/line-oa/notifications", json={"notify_class_reminder": False}, headers=auth(admin))
    at["value"] = datetime(2030, 1, 2, 20, 30)
    line_member.dispatch_tenant(tenants["alpha"], with_reminders=True)
    assert len(pushes.pushes) == 1


def test_reminder_hour_setting(client, admin, linked, db, plan, pushes, at, tenants):
    client.patch(f"{API}/line-oa/notifications", json={"reminder_hour": 9}, headers=auth(admin))
    add_confirmed(db, linked, plan, date(2030, 1, 2), 18)
    at["value"] = datetime(2030, 1, 1, 10, 30)
    line_member.dispatch_tenant(tenants["alpha"], with_reminders=True)
    assert len(pushes.pushes) == 1


def test_settings_validation_log_and_quota(client, beta_client, admin, beta_admin, linked, member, db, plan, pushes):
    headers = auth(admin)
    assert client.patch(f"{API}/line-oa/notifications", json={"reminder_hour": 23}, headers=headers).status_code == 422
    assert client.patch(f"{API}/line-oa/notifications", json={"notify_class_reminder": False},
                        headers=auth(member)).status_code == 403
    rid = submit(client, linked, plan)
    client.post(f"{API}/reservations/{rid}/review", json={"status": "已確認"}, headers=headers)
    pushes.run()
    log = client.get(f"{API}/line-oa/messages", headers=headers).json()
    assert log[0]["event"] == "預約成功" and log[0]["member_name"] == "王小明" and log[0]["status"] == "成功"
    assert "message" not in log[0]
    assert client.get(f"{API}/line-oa/messages", headers=auth(member)).status_code == 403
    assert beta_client.get(f"{API}/line-oa/messages", headers=auth(beta_admin)).json() == []

    assert client.get(f"{API}/line-oa/quota", headers=headers).json() == {"limited": True, "limit": 200, "used": 37, "error": None}
    pushes.quota = {"type": "none"}
    assert client.get(f"{API}/line-oa/quota", headers=headers).json()["limited"] is False


def test_unlinked_after_enqueue_is_skipped(client, admin, linked, db, plan, pushes):
    rid = submit(client, linked, plan)
    client.post(f"{API}/reservations/{rid}/review", json={"status": "已確認"}, headers=auth(admin))
    linked.line_user_id = None
    db.commit()
    assert pushes.run() == []
    row = messages(db)[0]
    assert row.status == LineNotificationStatus.skipped_disabled and "解除" in row.note

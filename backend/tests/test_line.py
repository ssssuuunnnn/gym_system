"""
LINE 通知店家（ADR 0004）：綁定、事件通知、每月上限、重試、平台用量，以及權限與個資邊界。
"""

import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.config import settings
from app.core.security import create_platform_token
from app.main import app
from app.models.line import LineEvent, LineNotification, LineNotificationStatus, LineRecipient
from app.models.product import Product, ProductCategory
from app.services import line as line_service
from app.services.line import LineApiError
from tests.conftest import auth

API = "/api/v1"


class FakeLine:
    """攔下所有 LINE API 呼叫；fail_with 設定時 multicast 丟出該錯誤。"""

    def __init__(self):
        self.multicasts: list[tuple[list[str], list[dict]]] = []
        self.replies: list[tuple[str, list[dict]]] = []
        self.fail_with: LineApiError | None = None
        self.profiles: dict[str, str] = {}

    def multicast(self, to, messages):
        if self.fail_with:
            raise self.fail_with
        self.multicasts.append((list(to), messages))

    def reply(self, reply_token, messages):
        self.replies.append((reply_token, messages))

    def get_profile(self, user_id):
        return {"displayName": self.profiles.get(user_id, "LINE 使用者")}

    def last_reply_text(self) -> str:
        return self.replies[-1][1][0]["text"]


@pytest.fixture()
def fake_line(monkeypatch):
    """
    換成假的 LINE client，並把「回應後發送」改成由測試呼叫 run() 才發送：
    測試裡所有 Session 共用一條連線，背景工作若在請求的 Session 關閉前執行，
    請求關閉時的 savepoint 回滾會連背景工作的更新一起撤銷（正式環境各自一條連線，沒有這個問題）。
    """
    from app.core.tenant_context import current_tenant

    fake = FakeLine()
    fake.scheduled = []
    monkeypatch.setattr(line_service, "get_client", lambda: fake)

    def schedule(background_tasks, notification_id):
        if notification_id is not None:
            fake.scheduled.append((current_tenant.get().id, notification_id))

    def run():
        while fake.scheduled:
            tenant_id, notification_id = fake.scheduled.pop(0)
            line_service.dispatch_tenant(tenant_id, [notification_id])

    monkeypatch.setattr(line_service, "schedule", schedule)
    fake.run = run
    return fake


def add_recipient(db, user_id, name, **flags) -> LineRecipient:
    r = LineRecipient(line_user_id=user_id, display_name=name, **flags)
    db.add(r)
    db.commit()
    return r


def notifications(db) -> list[LineNotification]:
    db.expire_all()
    return db.query(LineNotification).order_by(LineNotification.id).all()


def alt_texts(fake) -> list[str]:
    return [messages[0]["altText"] for _, messages in fake.multicasts]


# ---------- 後台設定 ----------


def test_settings_and_bind_code(client, admin, member, db):
    res = client.get(f"{API}/line/settings", headers=auth(admin))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["configured"] is True
    assert body["add_friend_url"] == "https://line.me/R/ti/p/@testbot"
    assert (body["month_sent"], body["monthly_cap"], body["recipients"]) == (0, 300, [])

    res = client.post(f"{API}/line/bind-codes", headers=auth(admin))
    assert res.status_code == 201
    code = res.json()
    assert len(code["code"]) == 6 and code["code"].isdigit()
    status_url = f"{API}/line/bind-codes/{code['id']}"
    assert client.get(status_url, headers=auth(admin)).json()["status"] == "waiting"
    db.execute(text("UPDATE line_bind_codes SET expires_at = now() - interval '1 day' WHERE id = :i"), {"i": code["id"]})
    assert client.get(status_url, headers=auth(admin)).json()["status"] == "expired"
    # 資料庫只存雜湊，不存明碼
    stored = db.execute(text("SELECT code_hash FROM line_bind_codes WHERE id = :i"), {"i": code["id"]}).scalar()
    assert code["code"] not in stored

    assert client.get(f"{API}/line/settings", headers=auth(member)).status_code == 403
    assert client.post(f"{API}/line/bind-codes", headers=auth(member)).status_code == 403


def test_update_remove_and_isolation(client, beta_client, admin, beta_admin, db):
    r = add_recipient(db, "U-alpha-1", "陳老闆")
    alpha_headers, beta_headers = auth(admin), auth(beta_admin)
    res = client.patch(f"{API}/line/recipients/{r.id}", json={"notify_booking": False}, headers=alpha_headers)
    assert res.json()["notify_booking"] is False and res.json()["notify_inquiry"] is True
    # 別家看不到、改不到
    assert beta_client.get(f"{API}/line/settings", headers=beta_headers).json()["recipients"] == []
    assert beta_client.delete(f"{API}/line/recipients/{r.id}", headers=beta_headers).status_code == 404
    assert client.delete(f"{API}/line/recipients/{r.id}", headers=alpha_headers).status_code == 204
    assert client.get(f"{API}/line/settings", headers=alpha_headers).json()["recipients"] == []


def test_test_notification_goes_to_one_person(client, admin, db, fake_line):
    r1 = add_recipient(db, "U-1", "陳老闆")
    add_recipient(db, "U-2", "Alex")
    res = client.post(f"{API}/line/recipients/{r1.id}/test", headers=auth(admin))
    fake_line.run()
    assert res.status_code == 202 and res.json() == {"queued": True}
    assert fake_line.multicasts[0][0] == ["U-1"]
    assert "測試通知" in alt_texts(fake_line)[0]


# ---------- 事件通知 ----------


@pytest.fixture()
def plan(db):
    p = Product(name="私人課 10 堂", category=ProductCategory.single_course, session_hours=10, price=12000)
    db.add(p)
    db.commit()
    return p


def test_member_purchase_notifies_subscribers_only(client, member, db, plan, fake_line):
    add_recipient(db, "U-boss", "陳老闆")
    add_recipient(db, "U-coach", "Alex", notify_payment=False)
    add_recipient(db, "U-gone", "離職員工", is_active=False)
    res = client.post(f"{API}/purchases/self", json={"product_id": plan.id, "quantity": 2}, headers=auth(member))
    fake_line.run()
    assert res.status_code == 201, res.text
    assert [to for to, _ in fake_line.multicasts] == [["U-boss"]]
    card = json.dumps(fake_line.multicasts[0][1][0], ensure_ascii=False)
    assert "會員下單" in card and "私人課 10 堂 × 2" in card and "NT$ 24,000" in card
    assert "http://alpha.localhost/admin/purchases" in card or "https://alpha.localhost/admin/purchases" in card
    assert "member" not in card  # 不寫會員身分
    n = notifications(db)[-1]
    assert (n.status, n.sent_count, n.message, n.recipient_ids) == (LineNotificationStatus.sent, 1, None, None)


def test_member_booking_notifies_but_admin_booking_does_not(client, admin, member, db, plan, fake_line):
    add_recipient(db, "U-boss", "陳老闆")
    body = {"member_id": member.id, "product_id": plan.id, "booking_date": "2030-01-02", "start_hour": 10, "people_count": 1}
    assert client.post(f"{API}/reservations", json=body, headers=auth(member)).status_code == 201
    fake_line.run()
    assert len(fake_line.multicasts) == 1 and "預約" in alt_texts(fake_line)[0]
    card = json.dumps(fake_line.multicasts[0][1][0], ensure_ascii=False)
    assert "1/2 10:00" in card and "私人課 10 堂" in card
    res = client.post(f"{API}/reservations", params={"as_admin": True}, json=body, headers=auth(admin))
    fake_line.run()
    assert res.status_code == 201
    assert len(fake_line.multicasts) == 1  # 管理員自己建立的不通知


def test_inquiry_notification_hides_phone(client, admin, db, fake_line):
    add_recipient(db, "U-boss", "陳老闆")
    client.get(f"{API}/website", headers=auth(admin))
    client.post(f"{API}/website/publish", headers=auth(admin))
    form = {"name": "王小明", "phone": "0912-345-678", "interest": "私人教練課", "slot": "平日晚上", "consent": "on"}
    assert client.post("/site/inquiry", data=form, follow_redirects=False).status_code == 303
    fake_line.run()
    card = json.dumps(fake_line.multicasts[0][1][0], ensure_ascii=False)
    assert "新的體驗課詢問" in card and "王先生／小姐" in card and "私人教練課" in card
    assert "0912" not in card and "小明" not in card


def test_nobody_subscribed_creates_nothing(client, member, db, plan, fake_line):
    add_recipient(db, "U-boss", "陳老闆", notify_payment=False)
    client.post(f"{API}/purchases/self", json={"product_id": plan.id, "quantity": 1}, headers=auth(member))
    fake_line.run()
    assert fake_line.multicasts == [] and notifications(db) == []


def test_monthly_cap(client, member, db, plan, fake_line):
    add_recipient(db, "U-boss", "陳老闆")
    add_recipient(db, "U-coach", "Alex")
    db.add(LineNotification(event=LineEvent.inquiry, status=LineNotificationStatus.sent, sent_count=299,
                            recipient_count=299, created_at=datetime.utcnow()))
    db.commit()
    client.post(f"{API}/purchases/self", json={"product_id": plan.id, "quantity": 1}, headers=auth(member))
    fake_line.run()
    assert fake_line.multicasts == []  # 299 + 2 > 300
    n = notifications(db)[-1]
    assert n.status == LineNotificationStatus.skipped_cap and "300" in n.note and n.message is None


def test_retry_then_success_and_permanent_failure(client, member, db, plan, fake_line, tenants):
    add_recipient(db, "U-boss", "陳老闆")
    fake_line.fail_with = LineApiError(500, "server error")
    client.post(f"{API}/purchases/self", json={"product_id": plan.id, "quantity": 1}, headers=auth(member))
    fake_line.run()
    n = notifications(db)[-1]
    assert n.status == LineNotificationStatus.retrying and n.attempts == 1
    assert "1 分鐘後重試" in n.note and n.message is not None
    assert n.next_attempt_at > datetime.utcnow() + timedelta(seconds=30)

    # 還沒到重試時間：背景程序不會處理
    assert line_service.dispatch_tenant(tenants["alpha"]) == 0
    db.execute(text("UPDATE line_notifications SET next_attempt_at = now() - interval '1 minute'"))
    fake_line.fail_with = None
    assert line_service.dispatch_tenant(tenants["alpha"]) == 1
    n = notifications(db)[-1]
    assert (n.status, n.sent_count) == (LineNotificationStatus.sent, 1)

    # 400 這類錯誤不重試
    fake_line.fail_with = LineApiError(400, "invalid message")
    client.post(f"{API}/purchases/self", json={"product_id": plan.id, "quantity": 1}, headers=auth(member))
    fake_line.run()
    n = notifications(db)[-1]
    assert n.status == LineNotificationStatus.failed and "400" in n.note and n.message is None


def test_retries_give_up_after_three(client, member, db, plan, fake_line, tenants):
    add_recipient(db, "U-boss", "陳老闆")
    fake_line.fail_with = LineApiError(None, "無法連線 LINE")
    client.post(f"{API}/purchases/self", json={"product_id": plan.id, "quantity": 1}, headers=auth(member))
    fake_line.run()
    for _ in range(3):
        db.execute(text("UPDATE line_notifications SET next_attempt_at = now() - interval '1 minute'"))
        line_service.dispatch_tenant(tenants["alpha"])
    n = notifications(db)[-1]
    assert (n.status, n.attempts) == (LineNotificationStatus.failed, 4)


def test_not_configured_skips(client, member, db, plan, fake_line, monkeypatch):
    add_recipient(db, "U-boss", "陳老闆")
    monkeypatch.setattr(line_service, "get_client", lambda: None)
    client.post(f"{API}/purchases/self", json={"product_id": plan.id, "quantity": 1}, headers=auth(member))
    fake_line.run()
    fake_line.run()
    assert notifications(db)[-1].status == LineNotificationStatus.skipped_disabled


def test_masked_name_and_code_normalization():
    assert line_service.masked_name("王小明") == "王先生／小姐"
    assert line_service.masked_name("  ") == "（未填姓名）"
    assert line_service.normalize_bind_code("482 913") == "482913"
    assert line_service.normalize_bind_code("482-913") == "482913"
    assert line_service.normalize_bind_code("你好") is None
    assert line_service.normalize_bind_code("1234567") is None


# ---------- webhook（真的提交：webhook 用平台帳號的另一條連線） ----------


def sign(body: bytes) -> str:
    return base64.b64encode(hmac.new(settings.LINE_CHANNEL_SECRET.encode(), body, hashlib.sha256).digest()).decode()


def post_webhook(events, *, signature=None, host="platform.localhost"):
    body = json.dumps({"destination": "Ubot", "events": events}).encode()
    return TestClient(app, base_url=f"http://{host}").post(
        f"{API}/line/webhook",
        content=body,
        headers={"content-type": "application/json", "x-line-signature": signature or sign(body)},
    )


def text_event(user_id, message, token="rt"):
    return {"type": "message", "replyToken": token, "source": {"type": "user", "userId": user_id},
            "message": {"type": "text", "id": "1", "text": message}}


@pytest.fixture()
def committed_line(owner_engine, tenants, connection):
    """webhook 測試的資料直接提交；結束後清掉兩家的 LINE 資料。"""
    def insert_code(tenant, code, minutes=10, by="admin"):
        with owner_engine.begin() as conn:
            conn.execute(
                text("INSERT INTO line_bind_codes (tenant_id, code_hash, expires_at, created_by_name, created_at) "
                     "VALUES (:t, :h, (now() AT TIME ZONE 'utc') + make_interval(mins => :m), :b, now())"),
                {"t": tenants[tenant], "h": line_service.hash_bind_code(code), "m": minutes, "b": by},
            )

    def recipients(tenant):
        with owner_engine.connect() as conn:
            return conn.execute(
                text("SELECT line_user_id, display_name, is_active, bound_by_name FROM line_recipients "
                     "WHERE tenant_id = :t ORDER BY id"), {"t": tenants[tenant]}).all()

    yield insert_code, recipients
    with owner_engine.begin() as conn:
        ids = {"a": tenants["alpha"], "b": tenants["beta"]}
        for table in ("line_recipients", "line_bind_codes", "line_notifications"):
            conn.execute(text(f"DELETE FROM {table} WHERE tenant_id IN (:a, :b)"), ids)
        conn.execute(text("DELETE FROM line_bind_attempts WHERE line_user_id LIKE 'U-test-%'"))
        conn.execute(text("UPDATE tenants SET line_monthly_cap = 300 WHERE id IN (:a, :b)"), ids)


def test_webhook_signature_and_host(fake_line, committed_line):
    assert post_webhook([], signature="bad").status_code == 403
    assert post_webhook([], host="alpha.localhost").status_code == 404
    assert post_webhook([]).status_code == 200


def test_bind_by_code(fake_line, committed_line):
    insert_code, recipients = committed_line
    insert_code("alpha", "482913", by="boss-admin")
    fake_line.profiles["U-test-1"] = "小美"

    post_webhook([{"type": "follow", "replyToken": "rt0", "source": {"type": "user", "userId": "U-test-1"}}])
    assert "6 位數綁定碼" in fake_line.last_reply_text()

    post_webhook([text_event("U-test-1", "482 913")])
    assert "綁定成功" in fake_line.last_reply_text() and "Alpha 健身" in fake_line.last_reply_text()
    assert recipients("alpha") == [("U-test-1", "小美", True, "boss-admin")]
    assert recipients("beta") == []

    # 同一組碼不能再用
    post_webhook([text_event("U-test-2", "482913")])
    assert "不正確或已過期" in fake_line.last_reply_text()

    # 封鎖 → 停用
    post_webhook([{"type": "unfollow", "source": {"type": "user", "userId": "U-test-1"}}])
    assert recipients("alpha")[0][2] is False

    # 用新的碼重新綁定 → 同一筆重新啟用
    insert_code("alpha", "111222")
    post_webhook([text_event("U-test-1", "111222")])
    assert recipients("alpha") == [("U-test-1", "小美", True, "admin")]


def test_bind_status_seen_by_admin(client, admin, fake_line, committed_line, owner_engine, tenants):
    """後台輪詢：對方傳碼後狀態變成 bound，帶出接收人名稱。"""
    insert_code, _ = committed_line
    insert_code("alpha", "654321")
    with owner_engine.connect() as conn:
        code_id = conn.execute(text("SELECT max(id) FROM line_bind_codes WHERE tenant_id = :t"),
                               {"t": tenants["alpha"]}).scalar()
    fake_line.profiles["U-test-5"] = "Alex"
    post_webhook([text_event("U-test-5", "654321")])
    res = client.get(f"{API}/line/bind-codes/{code_id}", headers=auth(admin)).json()
    assert res["status"] == "bound" and res["recipient"]["display_name"] == "Alex"


def test_expired_and_ambiguous_codes(fake_line, committed_line):
    insert_code, recipients = committed_line
    insert_code("alpha", "222333", minutes=-1)
    post_webhook([text_event("U-test-3", "222333")])
    assert "不正確或已過期" in fake_line.last_reply_text()
    # 兩家碰巧同碼：誰都不綁，避免綁錯健身房
    insert_code("alpha", "777888")
    insert_code("beta", "777888")
    post_webhook([text_event("U-test-3", "777888")])
    assert "不正確或已過期" in fake_line.last_reply_text()
    assert recipients("alpha") == [] and recipients("beta") == []


def test_bind_attempt_rate_limit(fake_line, committed_line):
    insert_code, recipients = committed_line
    for _ in range(5):
        post_webhook([text_event("U-test-4", "000000")])
    insert_code("alpha", "999000")
    post_webhook([text_event("U-test-4", "999000")])
    assert "嘗試次數太多" in fake_line.last_reply_text()
    assert recipients("alpha") == []


def test_other_text_gets_help(fake_line, committed_line):
    post_webhook([text_event("U-test-6", "你好")])
    assert "6 位數綁定碼" in fake_line.last_reply_text()


# ---------- 平台：用量、紀錄、上限 ----------


def test_platform_usage_logs_and_cap(platform_admin, owner_engine, tenants, committed_line, platform_engine, monkeypatch):
    from app.db import session as db_session
    from sqlalchemy.orm import sessionmaker

    # 平台資料要提交才看得到：平台連線改用真的（提交）、平台管理員以 owner 建立
    with owner_engine.begin() as conn:
        admin_id = conn.execute(
            text("INSERT INTO platform_admins (username, password_hash, is_active, created_at) "
                 "VALUES ('line-ops', 'x', true, now()) RETURNING id")).scalar()
        conn.execute(text(
            "INSERT INTO line_recipients (tenant_id, line_user_id, display_name, notify_inquiry, notify_payment, "
            "notify_booking, is_active, created_at) VALUES (:t, 'U-test-p', '陳老闆', true, true, true, true, now())"),
            {"t": tenants["alpha"]})
        conn.execute(text(
            "INSERT INTO line_notifications (tenant_id, event, status, recipient_count, sent_count, attempts, "
            "next_attempt_at, created_at, updated_at, recipient_ids, message, note) VALUES "
            "(:t, 'inquiry', 'sent', 2, 2, 0, now(), (now() AT TIME ZONE 'utc'), now(), NULL, NULL, NULL),"
            "(:t, 'payment', 'failed', 1, 0, 1, now(), (now() AT TIME ZONE 'utc'), now(), NULL, NULL, 'LINE 回應 400：x'),"
            "(:t, 'booking', 'retrying', 1, 0, 1, now(), (now() AT TIME ZONE 'utc'), now(), '[\"U-secret\"]', "
            "'{\"altText\": \"secret\"}', '重試中')"),
            {"t": tenants["alpha"]})
    monkeypatch.setattr(db_session, "PlatformSessionLocal", sessionmaker(bind=platform_engine))
    try:
        pc = TestClient(app, base_url="http://platform.localhost")
        headers = {"Authorization": f"Bearer {create_platform_token(admin_id=admin_id)}"}
        summary = pc.get(f"{API}/platform/line/summary", headers=headers).json()
        alpha = next(g for g in summary["gyms"] if g["tenant_id"] == tenants["alpha"])
        assert (alpha["recipients"], alpha["sent"], alpha["failed"], alpha["retrying"], alpha["cap"]) == (1, 2, 1, 1, 300)
        assert summary["plan_quota"] == settings.LINE_PLAN_MONTHLY_QUOTA and summary["sent"] >= 2

        logs = pc.get(f"{API}/platform/line/logs", headers=headers).json()
        assert {(l["event"], l["status"]) for l in logs} >= {("新的體驗課詢問", "成功"), ("會員下單待收款", "失敗")}
        assert "U-secret" not in json.dumps(logs) and "secret" not in json.dumps(logs)  # 不含對象與內容
        failed = pc.get(f"{API}/platform/line/logs", params={"status": "失敗"}, headers=headers).json()
        assert all(l["status"] == "失敗" for l in failed) and failed

        res = pc.put(f"{API}/platform/tenants/{tenants['alpha']}", json={"line_monthly_cap": 500}, headers=headers)
        assert res.status_code == 200 and res.json()["line_monthly_cap"] == 500
        assert pc.put(f"{API}/platform/tenants/{tenants['alpha']}", json={"line_monthly_cap": -1},
                      headers=headers).status_code == 422
    finally:
        with owner_engine.begin() as conn:
            conn.execute(text("DELETE FROM platform_audit_logs WHERE admin_id = :i"), {"i": admin_id})
            conn.execute(text("DELETE FROM platform_admins WHERE id = :i"), {"i": admin_id})


def test_app_role_cannot_call_line_functions(connection):
    for sql in ("SELECT * FROM line_consume_bind_code('x', 'y')", "SELECT line_deactivate_user('y')",
                "SELECT * FROM platform_line_usage(now()::timestamp)", "SELECT count(*) FROM line_bind_attempts"):
        with connection.begin_nested() as sp:
            with pytest.raises(Exception, match="permission denied"):
                connection.execute(text(sql))
            sp.rollback()




def test_real_background_dispatch(client, admin, db, monkeypatch):
    """不攔 schedule：確認實際以 BackgroundTasks 在回應後發送。"""
    fake = FakeLine()
    monkeypatch.setattr(line_service, "get_client", lambda: fake)
    r = add_recipient(db, "U-bg", "陳老闆")
    assert client.post(f"{API}/line/recipients/{r.id}/test", headers=auth(admin)).status_code == 202
    assert fake.multicasts and fake.multicasts[0][0] == ["U-bg"]
    assert notifications(db)[-1].status == LineNotificationStatus.sent

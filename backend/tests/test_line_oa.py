"""
健身房自己的 LINE 官方帳號（ADR 0005）：設定與加密、檢查連線、LINE 登入／加入／綁定／解除、Webhook，
以及租戶隔離與權限。LINE API 全部以假的 client 取代。
"""

import base64
import hashlib
import hmac
import json

import pytest
from sqlalchemy import text

from app.core.security import create_line_link_token, hash_password
from app.models.line_oa import LineOaChannel
from app.models.user import User, UserRole
from app.services import line_oa as oa
from app.services.line import LineApiError
from tests.conftest import auth

API = "/api/v1"
SECRET = "alpha-channel-secret-1234"
TOKEN = "alpha-access-token-abcd"
LOGIN_ID = "2001234567"
LIFF_ID = "2001234567-AbCdEfGh"
SETTINGS = {"channel_secret": SECRET, "access_token": TOKEN, "login_channel_id": LOGIN_ID, "liff_id": LIFF_ID}


class FakeOa:
    """攔下所有 LINE API 呼叫並記錄。"""

    def __init__(self):
        self.tokens: list[str] = []
        self.calls: list[tuple] = []
        self.replies: list[tuple[str, list[dict]]] = []
        self.bot_error: LineApiError | None = None
        self.webhook_error: LineApiError | None = None
        self.webhook_success = True
        self.menu_seq = 0
        # id_token → (預期的 client_id, LINE 個人資料)
        self.id_tokens: dict[str, dict] = {}
        self.verified_with: list[str] = []
        self.pushes: list[tuple[str, list[dict]]] = []
        self.push_error: LineApiError | None = None
        self.quota = {"type": "limited", "value": 200}
        self.usage = 37
        self.audiences: list[tuple[str, list[str]]] = []
        self.audience_error: LineApiError | None = None

    # OaClient
    def get_bot_info(self):
        if self.bot_error:
            raise self.bot_error
        return {"basicId": "@alphagym", "displayName": "Alpha 健身", "pictureUrl": "https://example.com/p.png"}

    def set_webhook(self, endpoint):
        if self.webhook_error:
            raise self.webhook_error
        self.calls.append(("set_webhook", endpoint))

    def test_webhook(self):
        return {"success": self.webhook_success, "reason": "" if self.webhook_success else "COULD_NOT_CONNECT"}

    def create_rich_menu(self, body):
        self.menu_seq += 1
        self.calls.append(("create_rich_menu", body))
        return f"richmenu-{self.menu_seq}"

    def upload_rich_menu_image(self, rich_menu_id, png):
        assert png[:8] == b"\x89PNG\r\n\x1a\n"
        self.calls.append(("upload", rich_menu_id))

    def set_default_rich_menu(self, rich_menu_id):
        self.calls.append(("default", rich_menu_id))

    def delete_rich_menu(self, rich_menu_id):
        self.calls.append(("delete", rich_menu_id))

    def reply(self, reply_token, messages):
        self.replies.append((reply_token, messages))

    def push(self, to, messages):
        if self.push_error:
            raise self.push_error
        self.pushes.append((to, messages))

    def get_quota(self):
        return self.quota

    def get_quota_consumption(self):
        return {"totalUsage": self.usage}

    def create_audience(self, description, user_ids):
        if self.audience_error:
            raise self.audience_error
        self.audiences.append((description, list(user_ids)))
        return 9000 + len(self.audiences)

    # verify_id_token
    def verify(self, id_token, client_id):
        self.verified_with.append(client_id)
        profile = self.id_tokens.get(id_token)
        if profile is None or profile["aud"] != client_id:
            raise LineApiError(400, "invalid id token")
        return {"sub": profile["sub"], "name": profile["name"], "aud": client_id}


@pytest.fixture()
def fake_oa(monkeypatch):
    fake = FakeOa()

    def make_client(token):
        fake.tokens.append(token)
        return fake

    monkeypatch.setattr(oa, "make_client", make_client)
    monkeypatch.setattr(oa, "verify_id_token", fake.verify)
    return fake


@pytest.fixture()
def enabled(client, admin, fake_oa):
    """alpha 已設定並啟用 LINE 官方帳號。"""
    headers = auth(admin)
    assert client.put(f"{API}/line-oa", json=SETTINGS, headers=headers).status_code == 200
    res = client.post(f"{API}/line-oa/verify", headers=headers)
    assert res.json()["enabled"] is True
    return fake_oa


def line_user(fake: FakeOa, id_token: str, sub: str, name: str = "小明", aud: str = LOGIN_ID):
    fake.id_tokens[id_token] = {"sub": sub, "name": name, "aud": aud}


def sign(body: bytes, secret: str = SECRET) -> str:
    return base64.b64encode(hmac.new(secret.encode(), body, hashlib.sha256).digest()).decode()


# ---------- 設定 ----------


def test_settings_validation_and_encryption(client, admin, member, db, fake_oa, connection):
    headers = auth(admin)
    res = client.get(f"{API}/line-oa", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["configured"] is False and body["enabled"] is False
    assert body["webhook_url"] == "https://alpha.localhost/api/v1/line-oa/webhook"
    assert body["liff_endpoint_url"] == "https://alpha.localhost/liff"
    # 會員不能讀寫
    assert client.get(f"{API}/line-oa", headers=auth(member)).status_code == 403
    assert client.put(f"{API}/line-oa", json=SETTINGS, headers=auth(member)).status_code == 403

    # 第一次必須填金鑰；LIFF ID 要屬於登入 channel
    assert client.put(f"{API}/line-oa", json={**SETTINGS, "access_token": ""}, headers=headers).status_code == 400
    bad = client.put(f"{API}/line-oa", json={**SETTINGS, "liff_id": "2009999999-AbCdEfGh"}, headers=headers)
    assert bad.status_code == 400 and "不屬於" in bad.json()["detail"]

    saved = client.put(f"{API}/line-oa", json=SETTINGS, headers=headers).json()
    assert saved["configured"] is True and saved["enabled"] is False
    assert saved["channel_secret_hint"] == "••••1234" and saved["access_token_hint"] == "••••abcd"
    assert SECRET not in json.dumps(saved) and TOKEN not in json.dumps(saved)
    # 資料庫裡是加密後的值
    row = connection.execute(text("SELECT channel_secret_enc, access_token_enc FROM line_oa_channels")).one()
    assert SECRET not in row[0] and TOKEN not in row[1]

    # 之後留空表示不變
    again = client.put(f"{API}/line-oa", json={**SETTINGS, "channel_secret": "", "access_token": None}, headers=headers)
    assert again.json()["channel_secret_hint"] == "••••1234"


def test_verify_enables_and_installs_menu(client, admin, fake_oa):
    headers = auth(admin)
    client.put(f"{API}/line-oa", json=SETTINGS, headers=headers)
    res = client.post(f"{API}/line-oa/verify", headers=headers).json()
    assert res["enabled"] is True
    assert {c["key"]: c["ok"] for c in res["checks"]} == {"liff": True, "bot": True, "webhook": True, "rich_menu": True}
    assert fake_oa.tokens[-1] == TOKEN  # 用解密後的 token 呼叫 LINE
    assert ("set_webhook", "https://alpha.localhost/api/v1/line-oa/webhook") in fake_oa.calls
    menu = next(body for name, body in fake_oa.calls if name == "create_rich_menu")
    assert [a["action"]["uri"] for a in menu["areas"]] == [
        f"https://liff.line.me/{LIFF_ID}/book",
        f"https://liff.line.me/{LIFF_ID}/bookings",
        f"https://liff.line.me/{LIFF_ID}/purchase",
        f"https://liff.line.me/{LIFF_ID}/me",
    ]
    assert ("default", "richmenu-1") in fake_oa.calls
    settings = res["settings"]
    assert settings["bot_name"] == "Alpha 健身" and settings["bot_basic_id"] == "@alphagym"
    assert settings["liff_url"] == f"https://liff.line.me/{LIFF_ID}"
    assert settings["add_friend_url"] == "https://line.me/R/ti/p/@alphagym"

    # 再檢查一次：換新選單，刪掉舊的
    client.post(f"{API}/line-oa/verify", headers=headers)
    assert ("default", "richmenu-2") in fake_oa.calls and ("delete", "richmenu-1") in fake_oa.calls

    # 改設定後要重新檢查才會啟用
    assert client.put(f"{API}/line-oa", json=SETTINGS, headers=headers).json()["enabled"] is False


def test_verify_failures(client, admin, fake_oa):
    headers = auth(admin)
    client.put(f"{API}/line-oa", json=SETTINGS, headers=headers)
    # Webhook 失敗（例如本機沒有 https）只提示，仍然啟用
    fake_oa.webhook_error = LineApiError(400, "Invalid webhook endpoint URL")
    res = client.post(f"{API}/line-oa/verify", headers=headers).json()
    assert res["enabled"] is True
    webhook = next(c for c in res["checks"] if c["key"] == "webhook")
    assert webhook["ok"] is False and webhook["required"] is False
    # token 無效：不啟用
    fake_oa.bot_error = LineApiError(401, "Authentication failed")
    res = client.post(f"{API}/line-oa/verify", headers=headers).json()
    assert res["enabled"] is False
    assert "無效" in next(c for c in res["checks"] if c["key"] == "bot")["detail"]
    assert "官方帳號" in res["settings"]["last_error"]


def test_public_info_and_disable(client, admin, enabled):
    pub = client.get(f"{API}/line-oa/public").json()
    assert pub == {
        "enabled": True,
        "liff_id": LIFF_ID,
        "gym_name": "Alpha 健身",
        "bot_name": "Alpha 健身",
        "add_friend_url": "https://line.me/R/ti/p/@alphagym",
    }
    client.post(f"{API}/line-oa/disable", headers=auth(admin))
    assert client.get(f"{API}/line-oa/public").json()["enabled"] is False


def test_tenant_isolation(client, beta_client, admin, beta_admin, enabled):
    beta = beta_client.get(f"{API}/line-oa", headers=auth(beta_admin)).json()
    assert beta["configured"] is False
    assert beta_client.get(f"{API}/line-oa/public").json()["enabled"] is False
    assert beta_client.post(f"{API}/auth/line", json={"id_token": "x" * 20}).status_code == 404


# ---------- LINE 登入／加入／綁定 ----------


def test_join_then_login(client, db, enabled):
    line_user(enabled, "idtoken-new-user-1", "U-new-1", "小明")
    first = client.post(f"{API}/auth/line", json={"id_token": "idtoken-new-user-1"}).json()
    assert first["status"] == "unlinked" and first["token"] is None and first["line_display_name"] == "小明"
    assert enabled.verified_with[-1] == LOGIN_ID  # 用這家的登入 channel 驗證

    link_token = first["link_token"]
    # link_token 不能拿來呼叫一般 API
    assert client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {link_token}"}).status_code == 401
    # 必須同意個資告知、手機格式正確
    base = {"link_token": link_token, "display_name": "王小明", "phone": "0912-345-678", "consent": True}
    assert client.post(f"{API}/auth/line/join", json={**base, "consent": False}).status_code == 400
    assert client.post(f"{API}/auth/line/join", json={**base, "phone": "abc12345"}).status_code == 400

    joined = client.post(f"{API}/auth/line/join", json=base)
    assert joined.status_code == 201
    token = joined.json()["access_token"]
    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["display_name"] == "王小明" and me["phone"] == "0912345678"
    assert me["line_linked"] is True and me["line_display_name"] == "小明"
    assert me["has_password"] is False and me["username"].startswith("line-") and me["role"] == "member"

    # 沒有密碼：帳號密碼登入一律失敗
    assert client.post(f"{API}/auth/login", data={"username": me["username"], "password": "!"}).status_code == 401
    # 同一個 LINE 不能再加入一次
    assert client.post(f"{API}/auth/line/join", json=base).status_code == 409
    # 之後直接登入
    again = client.post(f"{API}/auth/line", json={"id_token": "idtoken-new-user-1"}).json()
    assert again["status"] == "ok" and again["token"]["role"] == "member"


def test_wrong_audience_and_bad_token(client, enabled):
    line_user(enabled, "idtoken-other-channel", "U-x", aud="2009999999")
    assert client.post(f"{API}/auth/line", json={"id_token": "idtoken-other-channel"}).status_code == 401
    assert client.post(f"{API}/auth/line", json={"id_token": "idtoken-unknown-xx"}).status_code == 401


def test_link_existing_account(client, admin, member, other_member, db, enabled):
    line_user(enabled, "idtoken-member-1", "U-member", "會員本人")
    link_token = client.post(f"{API}/auth/line", json={"id_token": "idtoken-member-1"}).json()["link_token"]
    base = {"link_token": link_token, "username": "member", "password": "pw"}
    assert client.post(f"{API}/auth/line/link", json={**base, "password": "wrong"}).status_code == 401
    assert client.post(f"{API}/auth/line/link", json={**base, "username": "admin"}).status_code == 400

    res = client.post(f"{API}/auth/line/link", json=base)
    assert res.status_code == 200 and res.json()["role"] == "member"
    db.expire_all()
    assert db.get(User, member.id).line_user_id == "U-member"
    # 同一個 LINE 不能再綁另一個帳號；已綁定的帳號不能被別的 LINE 綁
    assert client.post(f"{API}/auth/line/link", json={**base, "username": "other"}).status_code == 409
    line_user(enabled, "idtoken-someone-else", "U-else")
    other_token = client.post(f"{API}/auth/line", json={"id_token": "idtoken-someone-else"}).json()["link_token"]
    assert client.post(f"{API}/auth/line/link", json={**base, "link_token": other_token}).status_code == 409
    # 已綁定 → 直接登入
    assert client.post(f"{API}/auth/line", json={"id_token": "idtoken-member-1"}).json()["status"] == "ok"


def test_blacklisted_cannot_login(client, member, db, enabled):
    member.line_user_id = "U-black"
    member.is_blacklisted = True
    db.commit()
    line_user(enabled, "idtoken-blacklisted", "U-black")
    assert client.post(f"{API}/auth/line", json={"id_token": "idtoken-blacklisted"}).status_code == 403


def test_link_token_is_per_gym(client, beta_client, beta_db, tenants, enabled):
    # beta 也啟用 LINE，拿 alpha 的 link_token 去 beta 加入會員 → 拒絕
    beta_db.add(LineOaChannel(channel_secret_enc="x", access_token_enc="x", login_channel_id="2005555555",
                              liff_id="2005555555-Beta1234", is_enabled=True))
    beta_db.commit()
    alpha_token = create_line_link_token(tenant_id=tenants["alpha"], line_user_id="U-cross", line_name=None)
    res = beta_client.post(f"{API}/auth/line/join", json={
        "link_token": alpha_token, "display_name": "跨店", "phone": "0912345678", "consent": True})
    assert res.status_code == 401


def test_unlink(client, admin, member, db, enabled):
    headers = auth(member)
    assert client.post(f"{API}/auth/line/unlink", headers=headers).status_code == 400  # 尚未綁定
    member.line_user_id = "U-m"
    db.commit()
    res = client.post(f"{API}/auth/line/unlink", headers=headers)
    assert res.status_code == 200 and res.json()["line_linked"] is False

    # 沒有密碼的會員不能自己解除；管理員可以
    line_user(enabled, "idtoken-nopass-1", "U-nopass")
    link_token = client.post(f"{API}/auth/line", json={"id_token": "idtoken-nopass-1"}).json()["link_token"]
    token = client.post(f"{API}/auth/line/join", json={
        "link_token": link_token, "display_name": "林", "phone": "0911222333", "consent": True}).json()["access_token"]
    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert client.post(f"{API}/auth/line/unlink", headers={"Authorization": f"Bearer {token}"}).status_code == 400
    out = client.post(f"{API}/users/{me['id']}/unlink-line", headers=auth(admin))
    assert out.status_code == 200 and out.json()["line_linked"] is False
    assert client.post(f"{API}/users/{me['id']}/unlink-line", headers=headers).status_code == 403


def test_admin_member_fields(client, admin, member, db):
    headers = auth(admin)
    res = client.put(f"{API}/users/{member.id}", json={"display_name": " 陳小美 ", "phone": "0987 654 321"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["display_name"] == "陳小美" and res.json()["phone"] == "0987654321"
    assert res.json()["username"] == "member" and res.json()["has_password"] is True
    assert client.put(f"{API}/users/{member.id}", json={"phone": "12"}, headers=headers).status_code == 400
    listed = client.get(f"{API}/users", headers=headers).json()
    assert listed[0]["line_linked"] is False and "phone" in listed[0]
    # 管理員設定密碼後，LINE 加入的會員也能用網頁登入
    member.password_hash = "!unusable"
    db.commit()
    client.post(f"{API}/users/{member.id}/reset-password", json={"new_password": "newpass123"}, headers=headers)
    assert client.post(f"{API}/auth/login", data={"username": "member", "password": "newpass123"}).status_code == 200


def test_payment_instructions(client, admin, member):
    res = client.put(f"{API}/system-settings", json={"payment_instructions": "轉帳：國泰 013 1234-5678"},
                     headers=auth(admin))
    assert res.json()["payment_instructions"] == "轉帳：國泰 013 1234-5678"
    assert client.get(f"{API}/system-settings", headers=auth(member)).json()["payment_instructions"].startswith("轉帳")


# ---------- Webhook ----------


def post_webhook(client, events, secret=SECRET):
    body = json.dumps({"destination": "U-bot", "events": events}).encode()
    return client.post(f"{API}/line-oa/webhook", content=body,
                       headers={"x-line-signature": sign(body, secret), "content-type": "application/json"})


def test_webhook(client, admin, enabled):
    assert post_webhook(client, [], secret="wrong-secret").status_code == 403
    assert post_webhook(client, [{"type": "follow", "replyToken": "r1", "source": {"userId": "U1"}}]).status_code == 200
    token, messages = enabled.replies[-1]
    assert token == "r1" and "Alpha 健身" in messages[0]["template"]["text"]
    assert messages[0]["template"]["actions"][0]["uri"] == f"https://liff.line.me/{LIFF_ID}/me"

    post_webhook(client, [{"type": "message", "replyToken": "r2", "message": {"type": "text", "text": "我的預約"}}])
    assert enabled.replies[-1][1][0]["template"]["actions"][0]["uri"] == f"https://liff.line.me/{LIFF_ID}/bookings"
    # 一般聊天不自動回覆，留給店家
    post_webhook(client, [{"type": "message", "replyToken": "r3", "message": {"type": "text", "text": "請問有停車位嗎"}}])
    assert enabled.replies[-1][0] == "r2"

    # 停用後：簽章正確仍回 200，但不回覆
    client.post(f"{API}/line-oa/disable", headers=auth(admin))
    assert post_webhook(client, [{"type": "follow", "replyToken": "r4"}]).status_code == 200
    assert enabled.replies[-1][0] == "r2"


def test_webhook_not_configured(client, beta_client):
    assert post_webhook(beta_client, []).status_code == 404

"""
健身房自己的 LINE 官方帳號（見 docs/adr/0005-gym-line-oa.md）。

- 管理員在系統設定填入 Messaging API 的 channel secret／access token、同一個 Provider 底下 LINE 登入 channel 的
  Channel ID 與 LIFF ID；「檢查連線」讀取官方帳號資料、設定 Webhook、建立底部選單，成功才啟用。
- 會員在 LINE 裡打開 LIFF（`https://liff.line.me/<LIFF ID>/<頁面>` → `/liff/<頁面>`），前端把 ID token 交給
  `/auth/line`，後端向 LINE 驗證（aud 必須是這家健身房的登入 channel）後，已綁定就登入，否則讓會員加入或綁定既有帳號。
- 同一個 Provider 底下 LINE 使用者 ID 相同，所以 LIFF 登入拿到的 ID 也能用來從官方帳號回覆或推播。
"""

import base64
import hashlib
import hmac
import re
from datetime import datetime
from pathlib import Path
from typing import Protocol

import httpx
from sqlalchemy.orm import Session

from app.services import terms
from app.core import crypto
from app.core.config import settings
from app.core.tenant_context import TenantInfo
from app.models.line_oa import LineOaChannel
from app.services.line import LineApiError

API_BASE = "https://api.line.me"
DATA_API_BASE = "https://api-data.line.me"
# 上傳受眾時每次請求最多的使用者 ID 數
AUDIENCE_CHUNK = 10_000
RICH_MENU_IMAGE = Path(__file__).resolve().parent.parent / "static" / "line" / "rich_menu.png"
RICH_MENU_SIZE = (2500, 843)
LIFF_ID_PATTERN = re.compile(r"^(\d{6,20})-[A-Za-z0-9]{4,40}$")
CHANNEL_ID_PATTERN = re.compile(r"^\d{6,20}$")

# 底部選單四格：標題、LIFF 內的頁面（/liff/<path> → 會員前台）
RICH_MENU_AREAS = [
    ("預約課程", "book"),
    ("我的預約", "bookings"),
    ("購買方案", "purchase"),
    ("會員中心", "me"),
]
# 會員在對話裡傳這些字時，回覆一個打開對應頁面的按鈕（回覆不計費）；其他訊息不回，留給店家在 LINE 官方帳號後台回覆
KEYWORDS = {
    "會員": ("會員中心", "me"),
    "會員中心": ("會員中心", "me"),
    "預約": ("預約課程", "book"),
    "我的預約": ("我的預約", "bookings"),
    "購買": ("購買方案", "purchase"),
}


def _label(label: str, path: str) -> str:
    """「預約課程」依行業換成「預約療程」等（ADR 0011）。"""
    return terms.t("book") if path == "book" else label


class OaClient(Protocol):
    def get_bot_info(self) -> dict: ...
    def set_webhook(self, endpoint: str) -> None: ...
    def test_webhook(self) -> dict: ...
    def create_rich_menu(self, body: dict) -> str: ...
    def upload_rich_menu_image(self, rich_menu_id: str, png: bytes) -> None: ...
    def set_default_rich_menu(self, rich_menu_id: str) -> None: ...
    def delete_rich_menu(self, rich_menu_id: str) -> None: ...
    def reply(self, reply_token: str, messages: list[dict]) -> None: ...
    def push(self, to: str, messages: list[dict]) -> None: ...
    def get_quota(self) -> dict: ...
    def get_quota_consumption(self) -> dict: ...
    def create_audience(self, description: str, user_ids: list[str]) -> int: ...


class HttpOaClient:
    def __init__(self, token: str):
        self._headers = {"Authorization": f"Bearer {token}"}

    def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        try:
            response = httpx.request(method, url, headers={**self._headers, **kwargs.pop("headers", {})},
                                     timeout=15.0, **kwargs)
        except httpx.HTTPError as exc:
            raise LineApiError(None, f"無法連線 LINE：{type(exc).__name__}") from exc
        if response.status_code >= 400:
            try:
                body = response.json()
                message = body.get("message", "")
                details = body.get("details") or []
                if details:
                    message += "：" + "；".join(d.get("message", "") for d in details)
            except ValueError:
                message = response.text[:200]
            raise LineApiError(response.status_code, message)
        return response

    def get_bot_info(self) -> dict:
        return self._request("GET", f"{API_BASE}/v2/bot/info").json()

    def set_webhook(self, endpoint: str) -> None:
        self._request("PUT", f"{API_BASE}/v2/bot/channel/webhook/endpoint", json={"endpoint": endpoint})

    def test_webhook(self) -> dict:
        return self._request("POST", f"{API_BASE}/v2/bot/channel/webhook/test", json={}).json()

    def create_rich_menu(self, body: dict) -> str:
        return self._request("POST", f"{API_BASE}/v2/bot/richmenu", json=body).json()["richMenuId"]

    def upload_rich_menu_image(self, rich_menu_id: str, png: bytes) -> None:
        self._request("POST", f"{DATA_API_BASE}/v2/bot/richmenu/{rich_menu_id}/content",
                      content=png, headers={"Content-Type": "image/png"})

    def set_default_rich_menu(self, rich_menu_id: str) -> None:
        self._request("POST", f"{API_BASE}/v2/bot/user/all/richmenu/{rich_menu_id}")

    def delete_rich_menu(self, rich_menu_id: str) -> None:
        self._request("DELETE", f"{API_BASE}/v2/bot/richmenu/{rich_menu_id}")

    def reply(self, reply_token: str, messages: list[dict]) -> None:
        self._request("POST", f"{API_BASE}/v2/bot/message/reply",
                      json={"replyToken": reply_token, "messages": messages})

    def push(self, to: str, messages: list[dict]) -> None:
        self._request("POST", f"{API_BASE}/v2/bot/message/push", json={"to": to, "messages": messages})

    def get_quota(self) -> dict:
        return self._request("GET", f"{API_BASE}/v2/bot/message/quota").json()

    def get_quota_consumption(self) -> dict:
        return self._request("GET", f"{API_BASE}/v2/bot/message/quota/consumption").json()

    def create_audience(self, description: str, user_ids: list[str]) -> int:
        """
        以 LINE 使用者 ID 建立受眾（Messaging API 與 LINE 官方帳號後台共用），回傳 audienceGroupId。
        一次最多 10,000 個 ID：第一批建立，其餘用 PUT 追加。
        """
        chunks = [user_ids[i:i + AUDIENCE_CHUNK] for i in range(0, len(user_ids), AUDIENCE_CHUNK)] or [[]]
        body = {"description": description, "isIfaAudience": False, "audiences": [{"id": u} for u in chunks[0]]}
        group_id = self._request("POST", f"{API_BASE}/v2/bot/audienceGroup/upload", json=body).json()["audienceGroupId"]
        for chunk in chunks[1:]:
            self._request("PUT", f"{API_BASE}/v2/bot/audienceGroup/upload",
                          json={"audienceGroupId": group_id, "audiences": [{"id": u} for u in chunk]})
        return group_id


def make_client(access_token: str) -> OaClient:
    """測試以 monkeypatch 換成假的 client。"""
    return HttpOaClient(access_token)


def client_for(channel: LineOaChannel) -> OaClient | None:
    token = crypto.decrypt(channel.access_token_enc)
    return make_client(token) if token else None


def verify_id_token(id_token: str, login_channel_id: str) -> dict:
    """
    向 LINE 驗證 LIFF 的 ID token；client_id 必須是這家健身房的登入 channel，避免拿別家的登入來用。
    回傳 {sub, name, picture, ...}；失敗丟 LineApiError。測試以 monkeypatch 取代。
    """
    try:
        response = httpx.post(f"{API_BASE}/oauth2/v2.1/verify",
                              data={"id_token": id_token, "client_id": login_channel_id}, timeout=10.0)
    except httpx.HTTPError as exc:
        raise LineApiError(None, f"無法連線 LINE：{type(exc).__name__}") from exc
    if response.status_code != 200:
        raise LineApiError(response.status_code, "LINE 登入驗證失敗")
    return response.json()


# ---------- 設定 ----------


def get_channel(db: Session) -> LineOaChannel | None:
    return db.query(LineOaChannel).first()


def get_enabled_channel(db: Session) -> LineOaChannel | None:
    channel = get_channel(db)
    return channel if channel and channel.is_enabled else None


def tenant_base_url(tenant: TenantInfo) -> str:
    return f"{settings.PUBLIC_SCHEME}://{tenant.subdomain}.{settings.BASE_DOMAIN}"


def webhook_url(tenant: TenantInfo) -> str:
    return f"{tenant_base_url(tenant)}{settings.API_V1_PREFIX}/line-oa/webhook"


def liff_endpoint_url(tenant: TenantInfo) -> str:
    return f"{tenant_base_url(tenant)}/liff"


def liff_url(liff_id: str, path: str = "") -> str:
    return f"https://liff.line.me/{liff_id}" + (f"/{path}" if path else "")


def add_friend_url(basic_id: str | None) -> str | None:
    if not basic_id:
        return None
    return f"https://line.me/R/ti/p/{basic_id if basic_id.startswith('@') else '@' + basic_id}"


def liff_id_problem(liff_id: str, login_channel_id: str) -> str | None:
    """LIFF ID 的格式是「登入 channel 的 Channel ID-隨機字串」，可以先在本地確認兩者對得上。"""
    if not CHANNEL_ID_PATTERN.match(login_channel_id):
        return "LINE 登入的 Channel ID 應為數字"
    match = LIFF_ID_PATTERN.match(liff_id)
    if not match:
        return "LIFF ID 格式不正確（例如 2001234567-AbCdEfGh）"
    if match.group(1) != login_channel_id:
        return "LIFF ID 不屬於這個 LINE 登入 channel，請確認 LIFF 建在同一個 channel 底下"
    return None


def verify_signature(channel: LineOaChannel, body: bytes, signature: str | None) -> bool:
    secret = crypto.decrypt(channel.channel_secret_enc)
    if not secret or not signature:
        return False
    digest = hmac.new(secret.encode(), body, hashlib.sha256).digest()
    return hmac.compare_digest(base64.b64encode(digest).decode(), signature)


def rich_menu_body(liff_id: str, gym_name: str) -> dict:
    width, height = RICH_MENU_SIZE
    cell = width // len(RICH_MENU_AREAS)
    return {
        "size": {"width": width, "height": height},
        "selected": True,
        "name": "會員選單",
        "chatBarText": "會員選單",
        "areas": [
            {
                "bounds": {"x": i * cell, "y": 0, "width": cell if i < len(RICH_MENU_AREAS) - 1 else width - i * cell,
                           "height": height},
                "action": {"type": "uri", "label": _label(label, path), "uri": liff_url(liff_id, path)},
            }
            for i, (label, path) in enumerate(RICH_MENU_AREAS)
        ],
    }


def install_rich_menu(client: OaClient, channel: LineOaChannel, gym_name: str) -> str:
    """建立新的底部選單並設為預設，成功後才刪掉舊的（失敗時舊選單照常運作）。"""
    new_id = client.create_rich_menu(rich_menu_body(channel.liff_id, gym_name))
    try:
        client.upload_rich_menu_image(new_id, RICH_MENU_IMAGE.read_bytes())
        client.set_default_rich_menu(new_id)
    except LineApiError:
        try:
            client.delete_rich_menu(new_id)
        except LineApiError:
            pass
        raise
    old_id, channel.rich_menu_id = channel.rich_menu_id, new_id
    if old_id and old_id != new_id:
        try:
            client.delete_rich_menu(old_id)
        except LineApiError:
            pass  # 舊選單可能已在 LINE 後台被刪掉
    return new_id


def run_checks(db: Session, channel: LineOaChannel, tenant: TenantInfo, gym_name: str) -> list[dict]:
    """
    「檢查連線」：依序檢查並回傳每一項結果。必要項目（required）全部通過才啟用；
    Webhook 與底部選單失敗只提示（本機開發沒有 https，LINE 不接受 Webhook 網址）。
    """
    checks: list[dict] = []

    def add(key: str, label: str, ok: bool, detail: str | None = None, required: bool = True):
        checks.append({"key": key, "label": label, "ok": ok, "detail": detail, "required": required})

    problem = liff_id_problem(channel.liff_id, channel.login_channel_id)
    add("liff", "LINE 登入與 LIFF", problem is None, problem)

    client = client_for(channel)
    bot_ok = False
    if client is None:
        add("bot", "官方帳號（Channel access token）", False, "金鑰無法解密，請重新輸入 Channel secret 與 access token")
    else:
        try:
            info = client.get_bot_info()
            channel.bot_basic_id = info.get("basicId")
            channel.bot_name = info.get("displayName")
            channel.bot_picture_url = info.get("pictureUrl")
            bot_ok = True
            add("bot", "官方帳號（Channel access token）", True, f"{channel.bot_name}（{channel.bot_basic_id}）")
        except LineApiError as exc:
            add("bot", "官方帳號（Channel access token）", False,
                "Channel access token 無效或已過期" if exc.status in (401, 403) else exc.message)

    if bot_ok and client is not None:
        url = webhook_url(tenant)
        try:
            client.set_webhook(url)
            try:
                result = client.test_webhook()
                ok = bool(result.get("success"))
                add("webhook", "Webhook 與 Channel secret", ok,
                    url if ok else f"LINE 無法呼叫 {url}（{result.get('detail') or result.get('reason') or '請確認網址可從外部連線、Channel secret 正確'}）",
                    required=False)
            except LineApiError as exc:
                add("webhook", "Webhook 與 Channel secret", False, exc.message, required=False)
        except LineApiError as exc:
            add("webhook", "Webhook 與 Channel secret", False,
                f"LINE 不接受 {url}：{exc.message}（正式環境需為 https）", required=False)

        if problem is None:
            try:
                install_rich_menu(client, channel, gym_name)
                add("rich_menu", "底部選單", True, "預約課程・我的預約・購買方案・會員中心", required=False)
            except LineApiError as exc:
                add("rich_menu", "底部選單", False, exc.message, required=False)

    ok = all(c["ok"] for c in checks if c["required"])
    channel.is_enabled = ok
    channel.verified_at = datetime.utcnow() if ok else channel.verified_at
    failed = [c for c in checks if not c["ok"]]
    channel.last_error = ("；".join(f"{c['label']}：{c['detail']}" for c in failed))[:500] if failed else None
    return checks


# ---------- 對話回覆 ----------


def link_button_message(liff_id: str, text: str, label: str, path: str) -> dict:
    return {
        "type": "template",
        "altText": f"{text}（{label}）",
        "template": {
            "type": "buttons",
            "text": text[:160],
            "actions": [{"type": "uri", "label": label[:20], "uri": liff_url(liff_id, path)}],
        },
    }


def welcome_message(liff_id: str, gym_name: str) -> dict:
    return link_button_message(
        liff_id, f"歡迎加入「{gym_name}」！加入會員後可以在這裡{terms.t('book')}、查詢預約與購買方案。", "加入會員／登入", "me"
    )


def keyword_reply(liff_id: str, text: str) -> dict | None:
    hit = KEYWORDS.get(text.strip())
    if not hit:
        return None
    label, path = hit
    label = _label(label, path)
    return link_button_message(liff_id, f"點下方按鈕打開「{label}」。", label, path)

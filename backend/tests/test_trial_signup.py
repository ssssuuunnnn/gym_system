"""
平台形象頁與自助申請試用（ADR 0013、R53–R56）：形象頁只在平台網址、申請表單驗證與防濫用、
開通後馬上能登入＋範例資料、試用到期後店家網址暫停、延長試用、平台聯絡方式的顯示開關、清除範例資料。
"""

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import deps
from app.core.security import create_platform_token, hash_password
from app.main import app
from app.models.platform import PlatformAdmin
from app.services import trial as trial_service
from tests.conftest import platform_auth

FORM = {
    "store_name": "Trial 健身",
    "business_type": "fitness",
    "subdomain": "tr-fit",
    "contact_name": "陳大文",
    "phone": "0912-345-678",
    "email": "Owner@Trial.example.com",
    "admin_username": "trialboss",
    "admin_password": "trial-pass-1",
    "consent": "on",
}


def _signup(platform_client, **overrides):
    data = {k: v for k, v in {**FORM, **overrides}.items() if v is not None}
    return platform_client.post("/site/signup", data=data, follow_redirects=False)


# ---------- 形象頁 ----------


def test_landing_only_on_platform_host(platform_client, client):
    res = platform_client.get("/")
    assert res.status_code == 200
    assert "申請試用" in res.text and 'action="/site/signup"' in res.text
    assert "免費試用 30 天" in res.text
    # 店家網址的 / 是店家自己的網站（未發布 ⇒ /login），也不能送申請表
    assert client.get("/", follow_redirects=False).status_code in (302, 303)
    assert client.post("/site/signup", data=FORM).status_code == 404
    assert client.get("/site/terms").status_code == 404
    assert platform_client.get("/site/terms").status_code == 200


def test_platform_robots_and_sitemap(platform_client):
    assert "Allow: /$" in platform_client.get("/robots.txt").text
    assert "/site/terms" in platform_client.get("/sitemap.xml").text


def test_contact_visibility_toggles(platform_client, platform_admin, client):
    headers = platform_auth(platform_admin)
    body = {
        "brand_name": "預約通",
        "signup_enabled": True,
        "contact_email": "hello@example.com",
        "show_email": True,
        "contact_line": "@yuyuetong",
        "show_line": False,
        "contact_phone": "02-1234-5678",
        "show_phone": True,
    }
    res = platform_client.put("/api/v1/platform/settings", json=body, headers=headers)
    assert res.status_code == 200, res.text
    page = platform_client.get("/").text
    assert "預約通" in page
    assert "hello@example.com" in page and "02-1234-5678" in page
    assert "@yuyuetong" not in page  # LINE 沒打開顯示

    # 操作紀錄只記改了哪些欄位
    logs = platform_client.get("/api/v1/platform/audit-logs", headers=headers).json()
    assert logs[0]["action"] == "update_platform_settings"
    assert "contact_email" in logs[0]["detail"]["changed"]

    # 驗證：LINE 只收 @ID 或 lin.ee／line.me
    bad = platform_client.put(
        "/api/v1/platform/settings", json={**body, "contact_line": "https://evil.example.com"}, headers=headers
    )
    assert bad.status_code == 422


def test_line_ask_button_toggle(platform_client, platform_admin):
    """R67：平台 LINE 官方帳號打開「顯示」才在形象頁出現「LINE 詢問」按鈕（頁首、首屏、申請區、聯絡區 QR、手機浮動）。"""
    headers = platform_auth(platform_admin)
    body = {
        "brand_name": "預約通",
        "signup_enabled": True,
        "contact_email": None,
        "show_email": False,
        "contact_line": "@yuyuetong",
        "show_line": True,
        "contact_phone": None,
        "show_phone": False,
    }
    try:
        assert platform_client.put("/api/v1/platform/settings", json=body, headers=headers).status_code == 200
        page = platform_client.get("/").text
        url = "https://line.me/R/ti/p/@yuyuetong"
        # 頁首、首屏、申請區、聯絡區、手機浮動按鈕
        assert page.count(f'href="{url}"') == 5
        assert 'class="line-float"' in page
        assert 'class="line-qr"' in page and "<svg" in page
        assert "加入 @yuyuetong" in page

        # lin.ee 網址照用，按鈕不顯示網址
        res = platform_client.put(
            "/api/v1/platform/settings", json={**body, "contact_line": "https://lin.ee/AbC123"}, headers=headers
        )
        assert res.status_code == 200
        page = platform_client.get("/").text
        assert 'href="https://lin.ee/AbC123"' in page and "加入 LINE 官方帳號" in page

        # 暫停申請時，暫停說明裡也有 LINE 按鈕；「還在考慮？」那行跟著表單消失
        platform_client.put(
            "/api/v1/platform/settings", json={**body, "signup_enabled": False}, headers=headers
        )
        page = platform_client.get("/").text
        assert "目前暫停開放線上申請" in page and "請透過 LINE 或" in page
        assert "還在考慮？" not in page

        # 關掉顯示：形象頁完全沒有 LINE
        platform_client.put("/api/v1/platform/settings", json={**body, "show_line": False}, headers=headers)
        page = platform_client.get("/").text
        assert "line.me" not in page and "line-float" not in page and "line-qr" not in page
        assert 'id="contact"' not in page  # 其他聯絡方式也都沒開
    finally:
        platform_client.put("/api/v1/platform/settings", json={**body, "show_line": False}, headers=headers)


def test_settings_require_platform_admin(platform_client):
    assert platform_client.get("/api/v1/platform/settings").status_code == 401


def test_public_subdomain_check(platform_client, client):
    ok = platform_client.get("/api/v1/platform/public/check-subdomain", params={"subdomain": "brand-new"}).json()
    assert ok["available"] is True
    taken = platform_client.get("/api/v1/platform/public/check-subdomain", params={"subdomain": "alpha"}).json()
    assert taken["available"] is False and taken["reason"]
    reserved = platform_client.get("/api/v1/platform/public/check-subdomain", params={"subdomain": "platform"}).json()
    assert reserved["available"] is False
    # 店家網址沒有平台 API
    assert client.get("/api/v1/platform/public/check-subdomain", params={"subdomain": "x"}).status_code == 404


# ---------- 申請表單（不提交：平台連線整個回滾） ----------


def test_validation_errors_rerender_form(platform_client, platform_db):
    res = _signup(platform_client, store_name="", phone="123", email="nope", admin_password="short", consent=None)
    assert res.status_code == 400
    for msg in ("請輸入店名", "手機號碼格式不正確", "Email 格式不正確", "密碼至少", "請勾選同意"):
        assert msg in res.text
    # 已填的值保留，密碼不回填
    assert 'value="trialboss"' in res.text
    assert "trial-pass-1" not in res.text and "short" not in res.text.split('name="admin_password"')[1][:80]
    assert platform_db.execute(text("SELECT count(*) FROM tenants WHERE subdomain = 'tr-fit'")).scalar() == 0


def test_taken_and_reserved_subdomain(platform_client):
    assert "已" in _signup(platform_client, subdomain="alpha").text
    assert _signup(platform_client, subdomain="platform").status_code == 400


def test_honeypot_pretends_success(platform_client, platform_db):
    res = _signup(platform_client, website="http://spam.example.com")
    assert res.status_code == 303 and res.headers["location"] == "/site/signup/done"
    assert platform_db.execute(text("SELECT count(*) FROM trial_signups")).scalar() == 0
    assert "申請已送出" in platform_client.get("/site/signup/done").text


def test_signup_disabled(platform_client, platform_db):
    platform_db.execute(text("UPDATE platform_settings SET signup_enabled = false"))
    platform_db.commit()
    page = platform_client.get("/").text
    assert "目前暫停開放線上申請" in page and 'action="/site/signup"' not in page
    res = _signup(platform_client)
    assert res.status_code == 400 and "暫停開放線上申請" in res.text


def test_one_trial_per_phone_email_and_ip_limit(platform_client, platform_db):
    platform_db.execute(
        text(
            "INSERT INTO trial_signups (store_name, contact_name, phone, email, ip_hash, created_at) "
            "VALUES ('舊店', '某人', '0912345678', 'old@example.com', 'x', now())"
        )
    )
    platform_db.commit()
    res = _signup(platform_client, email="old@example.com")
    assert "這支手機已經申請過試用" in res.text and "這個 Email 已經申請過試用" in res.text

    hashed = trial_service.ip_hash("testclient")
    for i in range(trial_service.SIGNUP_IP_LIMIT):
        platform_db.execute(
            text(
                "INSERT INTO trial_signups (store_name, contact_name, phone, email, ip_hash, created_at) "
                "VALUES ('店', '人', :p, :e, :h, now())"
            ),
            {"p": f"09000000{i:02d}", "e": f"ip{i}@example.com", "h": hashed},
        )
    platform_db.commit()
    res = _signup(platform_client, phone="0987654321", email="fresh@example.com")
    assert res.status_code == 400 and "申請次數已達上限" in res.text


# ---------- 端對端：真的提交（平台帳號），店家網址馬上能用 ----------


@pytest.fixture()
def committed(owner_engine, tenants):
    """不回滾的平台連線；測完以 owner 刪除這裡建立的店家與申請紀錄。要在 connection 之前建立、之後清除。"""
    with owner_engine.begin() as conn:
        admin_id = conn.execute(
            text("INSERT INTO platform_admins (username, password_hash, is_active, created_at) "
                 "VALUES ('trial-ops', :pw, true, now()) RETURNING id"),
            {"pw": hash_password("platform-pw")},
        ).scalar()
    yield admin_id
    with owner_engine.begin() as conn:
        conn.execute(text("DELETE FROM trial_signups"))
        conn.execute(text("DELETE FROM platform_audit_logs WHERE tenant_id IN (SELECT id FROM tenants WHERE subdomain LIKE 'tr-%')"))
        conn.execute(text("DELETE FROM platform_audit_logs WHERE admin_id = :id"), {"id": admin_id})
        conn.execute(text("DELETE FROM tenants WHERE subdomain LIKE 'tr-%'"))
        conn.execute(text("DELETE FROM platform_admins WHERE id = :id"), {"id": admin_id})


def _login(gym, username="trialboss", password="trial-pass-1"):
    res = gym.post("/api/v1/auth/login", data={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_signup_end_to_end(committed, connection, owner_engine):
    platform = TestClient(app, base_url="http://platform.localhost")
    gym = TestClient(app, base_url="http://tr-fit.localhost")

    res = _signup(platform, subdomain="TR-Fit")
    assert res.status_code == 303, res.text
    assert res.headers["location"] == "/site/signup/done?s=tr-fit"
    done = platform.get(res.headers["location"]).text
    assert "Trial 健身" in done and "tr-fit.localhost/login" in done

    # 店家：試用、30 天、自助申請；申請紀錄的手機已去掉符號、Email 小寫
    with owner_engine.connect() as conn:
        t = conn.execute(text("SELECT id, status, trial_ends_at, signup_source FROM tenants WHERE subdomain='tr-fit'")).one()
        s = conn.execute(text("SELECT phone, email FROM trial_signups WHERE tenant_id = :id"), {"id": t.id}).one()
        audit = conn.execute(text("SELECT action FROM platform_audit_logs WHERE tenant_id = :id"), {"id": t.id}).scalars().all()
    assert t.status == "trial" and t.signup_source == "self"
    assert abs((t.trial_ends_at - datetime.utcnow()) - timedelta(days=30)) < timedelta(minutes=5)
    assert (s.phone, s.email) == ("0912345678", "owner@trial.example.com")
    assert audit == ["self_signup"]

    # 馬上能登入，是主要管理者、不需要改密碼（自己設的）
    headers = _login(gym)
    me = gym.get("/api/v1/auth/me", headers=headers).json()
    assert me["staff"]["level"] == "主要管理者"
    assert me["display_name"] == "陳大文"

    # 範例資料：店名、2 位教練、方案、團體課＋方案、網站草稿
    settings = gym.get("/api/v1/system-settings", headers=headers).json()
    assert settings["company_name"] == "Trial 健身" and settings["has_sample_data"] is True
    coaches = gym.get("/api/v1/coaches", headers=headers).json()
    assert {c["name"] for c in coaches} == {"Alex 教練", "Mia 教練"}
    products = gym.get("/api/v1/products", headers=headers).json()
    assert {"單堂體驗課", "私人課 10 堂", "運動毛巾", "燃脂團課 8 週方案"} <= {p["name"] for p in products}
    courses = gym.get("/api/v1/courses", headers=headers).json()
    assert [c["name"] for c in courses] == ["晚間燃脂團課"] and courses[0]["session_count"] == 16
    website = gym.get("/api/v1/website", headers=headers).json()
    assert website["draft"] is not None

    # 試用資訊（公開）
    profile = gym.get("/api/v1/tenant/profile").json()
    assert profile["trial"]["days_left"] == 30 and profile["trial"]["expired"] is False

    # 同一支手機不能再申請
    again = _signup(platform, subdomain="tr-fit2", email="another@example.com")
    assert again.status_code == 400 and "這支手機已經申請過試用" in again.text

    # 清除範例資料：有人買過的方案只下架
    member = gym.post("/api/v1/auth/register", json={"username": "trialmember", "password": "member-pass-1"})
    assert member.status_code in (200, 201), member.text
    member_headers = _login(gym, "trialmember", "member-pass-1")
    used = next(p for p in products if p["name"] == "私人課 10 堂")
    assert gym.post("/api/v1/purchases/self", json={"product_id": used["id"], "quantity": 1}, headers=member_headers).status_code in (200, 201)
    cleared = gym.post("/api/v1/system-settings/clear-sample-data", headers=headers)
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["kept"] == 1
    left = gym.get("/api/v1/products", headers=headers).json()
    assert [(p["name"], p["is_active"]) for p in left] == [("私人課 10 堂", False)]
    assert gym.get("/api/v1/coaches", headers=headers).json() == []
    assert gym.get("/api/v1/courses", headers=headers).json() == []
    assert gym.get("/api/v1/system-settings", headers=headers).json()["has_sample_data"] is False
    # 會員不能清
    assert gym.post("/api/v1/system-settings/clear-sample-data", headers=member_headers).status_code == 403


def test_beauty_signup_sample_has_no_group_course(committed, connection):
    platform = TestClient(app, base_url="http://platform.localhost")
    gym = TestClient(app, base_url="http://tr-spa.localhost")
    res = _signup(platform, subdomain="tr-spa", business_type="beauty", store_name="Trial 美體",
                  phone="0922333444", email="spa@example.com")
    assert res.status_code == 303, res.text
    headers = _login(gym)
    assert gym.get("/api/v1/tenant/profile").json()["business_type"] == "美體"
    assert {c["name"] for c in gym.get("/api/v1/coaches", headers=headers).json()} == {"Amy 美容師", "Lily 美容師"}
    assert gym.get("/api/v1/courses", headers=headers).json() == []


def test_expired_trial_pauses_gym_and_extend_restores(committed, connection, owner_engine):
    platform = TestClient(app, base_url="http://platform.localhost")
    gym = TestClient(app, base_url="http://tr-fit.localhost")
    assert _signup(platform).status_code == 303
    headers = _login(gym)
    with owner_engine.begin() as conn:
        tenant_id = conn.execute(
            text("UPDATE tenants SET trial_ends_at = now() at time zone 'utc' - interval '1 hour' "
                 "WHERE subdomain = 'tr-fit' RETURNING id")
        ).scalar()
        conn.execute(text("UPDATE system_settings SET sample_data = NULL WHERE tenant_id = :id"), {"id": tenant_id})
    deps.clear_tenant_cache()

    # 店家 API 全部 403「試用已到期」，只剩 /tenant/profile
    res = gym.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 403 and res.json()["detail"] == deps.TRIAL_EXPIRED_DETAIL
    assert gym.post("/api/v1/auth/login", data={"username": "trialboss", "password": "trial-pass-1"}).status_code == 403
    profile = gym.get("/api/v1/tenant/profile")
    assert profile.status_code == 200
    assert profile.json()["trial"]["expired"] is True and profile.json()["trial"]["days_left"] == 0
    # 形象網站暫停
    site = gym.get("/", follow_redirects=False)
    assert site.status_code == 403 and "暫停服務" in site.text
    # 背景工作（LINE 提醒等）不處理到期的店家
    with owner_engine.connect() as conn:
        from sqlalchemy.orm import Session

        assert tenant_id not in trial_service.running_tenant_ids(Session(bind=conn))

    # 平台：列表看得到已到期，延長 7 天後馬上恢復
    p_headers = {"Authorization": f"Bearer {create_platform_token(admin_id=committed)}"}
    row = platform.get(f"/api/v1/platform/tenants/{tenant_id}", headers=p_headers).json()
    assert row["trial_expired"] is True and row["signup_source"] == "self"
    extended = platform.post(f"/api/v1/platform/tenants/{tenant_id}/trial", json={"days": 7}, headers=p_headers)
    assert extended.status_code == 200, extended.text
    assert extended.json()["trial_days_left"] == 7 and extended.json()["trial_expired"] is False
    assert gym.get("/api/v1/auth/me", headers=headers).status_code == 200
    logs = platform.get("/api/v1/platform/audit-logs", params={"tenant_id": tenant_id}, headers=p_headers).json()
    assert logs[0]["action"] == "extend_trial"

    # 轉為啟用後就不再有到期日
    platform.post(f"/api/v1/platform/tenants/{tenant_id}/status", json={"status": "啟用"}, headers=p_headers)
    row = platform.get(f"/api/v1/platform/tenants/{tenant_id}", headers=p_headers).json()
    assert row["trial_ends_at"] is None and row["trial_days_left"] is None
    assert gym.get("/api/v1/tenant/profile").json()["trial"] is None
    # 只有試用中的店家能延長
    assert platform.post(f"/api/v1/platform/tenants/{tenant_id}/trial", json={"days": 7}, headers=p_headers).status_code == 400


def test_done_page_does_not_leak_other_gyms(platform_client):
    # 不是自助申請（或超過一小時）的店家，完成頁不顯示
    page = platform_client.get("/site/signup/done", params={"s": "alpha"}).text
    assert "alpha.localhost" not in page and "申請已送出" in page


def test_days_left_rounds_up():
    from app.models.tenant import TenantStatus

    now = datetime(2026, 1, 1)
    assert trial_service.days_left(TenantStatus.trial, now + timedelta(days=29, hours=1), now) == 30
    assert trial_service.days_left(TenantStatus.trial, now - timedelta(seconds=1), now) == 0
    assert trial_service.days_left(TenantStatus.active, now + timedelta(days=3), now) is None

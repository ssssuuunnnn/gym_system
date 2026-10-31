"""
平台管理後台（ADR 0002）：開通／停用健身房、管理各家管理員帳號、操作紀錄，以及權限邊界。
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.security import create_platform_token, hash_password
from app.main import app
from app.models.platform import PlatformAdmin
from app.models.user import User, UserRole
from tests.conftest import auth, platform_auth

NEW_GYM = {
    "name": "Gamma 健身",
    "subdomain": "Gamma-Fit",
    "timezone": "Asia/Tokyo",
    "contact_name": "王小明",
    "contact_email": "owner@gamma.example.com",
    "admin_username": "boss",
    "admin_password": "boss-pass-1",
}


def _create_gym(platform_client, platform_admin, **overrides):
    return platform_client.post(
        "/api/v1/platform/tenants", json={**NEW_GYM, **overrides}, headers=platform_auth(platform_admin)
    )


# ---------- 網址與登入 ----------


def test_platform_api_only_on_platform_host(client):
    res = client.post("/api/v1/platform/auth/login", json={"username": "ops", "password": "platform-pw"})
    assert res.status_code == 404


def test_platform_host_is_not_a_gym(platform_client):
    assert platform_client.get("/api/v1/products").status_code == 404


def test_login(platform_client, platform_admin):
    bad = platform_client.post("/api/v1/platform/auth/login", json={"username": "ops", "password": "nope"})
    assert bad.status_code == 401
    unknown = platform_client.post("/api/v1/platform/auth/login", json={"username": "x", "password": "nope"})
    assert unknown.status_code == 401
    res = platform_client.post("/api/v1/platform/auth/login", json={"username": "ops", "password": "platform-pw"})
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    me = platform_client.get("/api/v1/platform/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["username"] == "ops"
    assert me.json()["last_login_at"] is not None


def test_inactive_platform_admin_cannot_use_api(platform_client, platform_admin, platform_db):
    platform_admin.is_active = False
    platform_db.commit()
    assert platform_client.get("/api/v1/platform/tenants", headers=platform_auth(platform_admin)).status_code == 401


def test_tokens_do_not_cross(client, platform_client, platform_admin, admin):
    """平台 token 不能打健身房 API；健身房管理員的 token 不能打平台 API。"""
    assert client.get("/api/v1/auth/me", headers=platform_auth(platform_admin)).status_code == 401
    assert platform_client.get("/api/v1/platform/tenants", headers=auth(admin)).status_code == 401
    assert platform_client.get("/api/v1/platform/tenants").status_code == 401


def test_change_password(platform_client, platform_admin):
    headers = platform_auth(platform_admin)
    bad = platform_client.post(
        "/api/v1/platform/auth/change-password",
        json={"current_password": "wrong", "new_password": "new-pass-123"},
        headers=headers,
    )
    assert bad.status_code == 400
    ok = platform_client.post(
        "/api/v1/platform/auth/change-password",
        json={"current_password": "platform-pw", "new_password": "new-pass-123"},
        headers=headers,
    )
    assert ok.status_code == 204
    res = platform_client.post("/api/v1/platform/auth/login", json={"username": "ops", "password": "new-pass-123"})
    assert res.status_code == 200


# ---------- 開通健身房 ----------


def test_create_tenant_with_first_admin(platform_client, platform_admin, platform_db):
    res = _create_gym(platform_client, platform_admin)
    assert res.status_code == 201, res.text
    gym = res.json()
    assert gym["subdomain"] == "gamma-fit"  # 自動轉小寫
    assert gym["status"] == "試用"
    assert gym["timezone"] == "Asia/Tokyo"
    assert gym["stats"]["admin_count"] == 1
    assert gym["stats"]["member_count"] == 0

    admins = platform_client.get(
        f"/api/v1/platform/tenants/{gym['id']}/admins", headers=platform_auth(platform_admin)
    ).json()
    assert [a["username"] for a in admins] == ["boss"]
    assert admins[0]["must_change_password"] is True

    logs = platform_client.get(
        "/api/v1/platform/audit-logs", params={"tenant_id": gym["id"]}, headers=platform_auth(platform_admin)
    ).json()
    assert [(log["action"], log["action_label"], log["admin_username"]) for log in logs] == [
        ("create_tenant", "開通店家", "ops")
    ]
    assert "boss-pass-1" not in str(logs)  # 紀錄裡不能有密碼


@pytest.mark.parametrize(
    "subdomain,reason",
    [("platform", "保留"), ("www", "保留"), ("-bad", "只能用"), ("有中文", "只能用"), ("alpha", "已經有店家")],
)
def test_subdomain_rules(platform_client, platform_admin, subdomain, reason):
    check = platform_client.get(
        "/api/v1/platform/tenants/check-subdomain",
        params={"subdomain": subdomain},
        headers=platform_auth(platform_admin),
    ).json()
    assert check["available"] is False and reason in check["reason"]
    res = _create_gym(platform_client, platform_admin, subdomain=subdomain)
    assert res.status_code == 400 and reason in res.json()["detail"]


def test_check_subdomain_available(platform_client, platform_admin):
    res = platform_client.get(
        "/api/v1/platform/tenants/check-subdomain",
        params={"subdomain": " New-Gym "},
        headers=platform_auth(platform_admin),
    ).json()
    assert res == {"subdomain": "new-gym", "available": True, "reason": None}


def test_failed_create_leaves_nothing_behind(platform_client, platform_admin):
    headers = platform_auth(platform_admin)
    before = len(platform_client.get("/api/v1/platform/tenants", headers=headers).json())
    assert _create_gym(platform_client, platform_admin, timezone="Mars/Olympus").status_code == 400
    assert _create_gym(platform_client, platform_admin, admin_password="short").status_code == 422
    assert _create_gym(platform_client, platform_admin, contact_email="not-an-email").status_code == 422
    assert len(platform_client.get("/api/v1/platform/tenants", headers=headers).json()) == before


def test_list_filters(platform_client, platform_admin):
    _create_gym(platform_client, platform_admin)
    headers = platform_auth(platform_admin)
    names = [t["subdomain"] for t in platform_client.get("/api/v1/platform/tenants", headers=headers).json()]
    assert {"alpha", "beta", "gamma-fit"} <= set(names)
    assert names[0] == "gamma-fit"  # 新的在前
    found = platform_client.get("/api/v1/platform/tenants", params={"q": "gamma"}, headers=headers).json()
    assert [t["subdomain"] for t in found] == ["gamma-fit"]
    active = platform_client.get("/api/v1/platform/tenants", params={"status": "啟用"}, headers=headers).json()
    assert "gamma-fit" not in [t["subdomain"] for t in active]


def test_stats_count_each_gym(platform_client, platform_admin, platform_db):
    gym = _create_gym(platform_client, platform_admin).json()
    other = _create_gym(platform_client, platform_admin, subdomain="delta", admin_username="d-boss").json()
    from app.db.session import act_as_tenant

    act_as_tenant(platform_db, gym["id"])
    platform_db.add_all(
        [User(username=f"m{i}", password_hash="x", role=UserRole.member) for i in range(3)]
    )
    platform_db.commit()

    stats = {
        t["subdomain"]: t["stats"]
        for t in platform_client.get("/api/v1/platform/tenants", headers=platform_auth(platform_admin)).json()
    }
    assert stats["gamma-fit"]["member_count"] == 3
    assert stats["gamma-fit"]["admin_count"] == 1
    assert stats[other["subdomain"]]["member_count"] == 0


# ---------- 修改、停用 ----------


def test_update_tenant_records_changes(platform_client, platform_admin):
    gym = _create_gym(platform_client, platform_admin).json()
    headers = platform_auth(platform_admin)
    res = platform_client.put(
        f"/api/v1/platform/tenants/{gym['id']}",
        json={"name": "Gamma 健身 信義店", "contact_phone": "02-1234-5678", "subdomain": "hacked", "note": "  "},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["name"] == "Gamma 健身 信義店"
    assert body["subdomain"] == "gamma-fit"  # 子網域不可修改
    assert body["note"] is None
    logs = platform_client.get(
        "/api/v1/platform/audit-logs", params={"tenant_id": gym["id"]}, headers=headers
    ).json()
    assert logs[0]["action"] == "update_tenant"
    assert logs[0]["detail"]["name"] == ["Gamma 健身", "Gamma 健身 信義店"]
    assert "note" not in logs[0]["detail"]  # 沒變的欄位不記

    bad = platform_client.put(
        f"/api/v1/platform/tenants/{gym['id']}", json={"timezone": "Nowhere"}, headers=headers
    )
    assert bad.status_code == 400


def test_set_status(platform_client, platform_admin):
    gym = _create_gym(platform_client, platform_admin).json()
    headers = platform_auth(platform_admin)
    res = platform_client.post(
        f"/api/v1/platform/tenants/{gym['id']}/status", json={"status": "停用", "reason": "未續約"}, headers=headers
    )
    assert res.json()["status"] == "停用"
    log = platform_client.get(
        "/api/v1/platform/audit-logs", params={"tenant_id": gym["id"]}, headers=headers
    ).json()[0]
    assert log["detail"] == {"from": "試用", "to": "停用", "reason": "未續約"}


def test_unknown_tenant_404(platform_client, platform_admin):
    headers = platform_auth(platform_admin)
    assert platform_client.get("/api/v1/platform/tenants/999999", headers=headers).status_code == 404
    assert (
        platform_client.post(
            "/api/v1/platform/tenants/999999/status", json={"status": "停用"}, headers=headers
        ).status_code
        == 404
    )


# ---------- 各家的管理員帳號 ----------


def test_manage_tenant_admins(platform_client, platform_admin):
    gym = _create_gym(platform_client, platform_admin).json()
    headers = platform_auth(platform_admin)
    base = f"/api/v1/platform/tenants/{gym['id']}/admins"

    dup = platform_client.post(base, json={"username": "BOSS", "password": "another-pass"}, headers=headers)
    assert dup.status_code == 400  # 帳號不分大小寫

    res = platform_client.post(base, json={"username": "manager", "password": "manager-pass"}, headers=headers)
    assert res.status_code == 201, res.text
    manager_id = res.json()["id"]

    reset = platform_client.post(
        f"{base}/{manager_id}/reset-password", json={"new_password": "reset-pass-1"}, headers=headers
    )
    assert reset.status_code == 200 and reset.json()["must_change_password"] is True

    assert [a["username"] for a in platform_client.get(base, headers=headers).json()] == ["boss", "manager"]
    actions = [
        log["action"]
        for log in platform_client.get(
            "/api/v1/platform/audit-logs", params={"tenant_id": gym["id"]}, headers=headers
        ).json()
    ]
    assert actions == ["reset_tenant_admin_password", "create_tenant_admin", "create_tenant"]


def test_cannot_reset_member_or_other_gyms_admin(platform_client, platform_admin, platform_db, tenants):
    gym = _create_gym(platform_client, platform_admin).json()
    headers = platform_auth(platform_admin)
    gamma_admin_id = platform_client.get(f"/api/v1/platform/tenants/{gym['id']}/admins", headers=headers).json()[0]["id"]

    # 用 gamma 的管理員 id 去重設 alpha 的帳號 → 找不到
    res = platform_client.post(
        f"/api/v1/platform/tenants/{tenants['alpha']}/admins/{gamma_admin_id}/reset-password",
        json={"new_password": "reset-pass-1"},
        headers=headers,
    )
    assert res.status_code == 404

    # 會員帳號不能由平台重設
    from app.db.session import act_as_tenant

    act_as_tenant(platform_db, gym["id"])
    member = User(username="m1", password_hash=hash_password("x"), role=UserRole.member)
    platform_db.add(member)
    platform_db.commit()
    res = platform_client.post(
        f"/api/v1/platform/tenants/{gym['id']}/admins/{member.id}/reset-password",
        json={"new_password": "reset-pass-1"},
        headers=headers,
    )
    assert res.status_code == 404


# ---------- 資料庫權限邊界 ----------


def test_platform_role_cannot_read_business_data(platform_connection):
    with platform_connection.begin_nested() as sp:
        with pytest.raises(DBAPIError, match="permission denied"):
            platform_connection.execute(text("SELECT count(*) FROM reservations"))
        sp.rollback()
    with platform_connection.begin_nested() as sp:
        with pytest.raises(DBAPIError, match="permission denied"):
            platform_connection.execute(text("SELECT count(*) FROM purchases"))
        sp.rollback()
    with platform_connection.begin_nested():
        platform_connection.execute(text("SELECT set_config('app.tenant_id', '', true)"))
        # users 有權限但受 RLS：沒切換到某家時一筆都看不到
        assert platform_connection.execute(text("SELECT count(*) FROM users")).scalar() == 0


def test_platform_role_is_not_superuser_or_bypassrls(platform_connection):
    row = platform_connection.execute(
        text("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
    ).one()
    assert tuple(row) == (False, False)


def test_app_role_cannot_touch_platform_tables(connection):
    for sql in (
        "SELECT count(*) FROM platform_admins",
        "SELECT count(*) FROM platform_audit_logs",
        "SELECT * FROM platform_tenant_stats(current_date)",
        "UPDATE tenants SET status = 'active'",
    ):
        with connection.begin_nested() as sp:
            with pytest.raises(DBAPIError, match="permission denied"):
                connection.execute(text(sql))
            sp.rollback()


# ---------- 端對端：真的提交，健身房網址馬上能用、停用馬上生效 ----------


@pytest.fixture()
def committed_platform(owner_engine, tenants):
    """不回滾的平台連線（測完以 owner 刪除建立的資料）；要在 connection 之前建立、之後清除。"""
    with Session(owner_engine) as s:
        admin = PlatformAdmin(username="e2e-ops", password_hash=hash_password("platform-pw"))
        s.add(admin)
        s.commit()
        admin_id = admin.id
    yield admin_id
    with owner_engine.begin() as conn:
        conn.execute(text("DELETE FROM tenants WHERE subdomain = 'e2e-gym'"))
        conn.execute(text("DELETE FROM platform_admins WHERE id = :id"), {"id": admin_id})


def test_end_to_end_provision_and_suspend(committed_platform, connection):
    headers = {"Authorization": f"Bearer {create_platform_token(admin_id=committed_platform)}"}
    platform = TestClient(app, base_url="http://platform.localhost")
    gym_client = TestClient(app, base_url="http://e2e-gym.localhost")

    assert gym_client.get("/api/v1/system-settings").status_code == 404  # 還沒開通

    res = platform.post(
        "/api/v1/platform/tenants",
        json={**NEW_GYM, "subdomain": "e2e-gym", "status": "啟用"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    gym_id = res.json()["id"]

    login = gym_client.post("/api/v1/auth/login", data={"username": "boss", "password": "boss-pass-1"})
    assert login.status_code == 200, login.text
    assert login.json()["role"] == "admin"
    assert login.json()["must_change_password"] is True
    gym_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert gym_client.get("/api/v1/auth/me", headers=gym_headers).status_code == 200

    platform.post(f"/api/v1/platform/tenants/{gym_id}/status", json={"status": "停用"}, headers=headers)
    assert gym_client.get("/api/v1/auth/me", headers=gym_headers).status_code == 403

    platform.post(f"/api/v1/platform/tenants/{gym_id}/status", json={"status": "啟用"}, headers=headers)
    assert gym_client.get("/api/v1/auth/me", headers=gym_headers).status_code == 200

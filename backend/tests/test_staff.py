"""
後台多使用者與功能權限（ADR 0008、R37–R39）：主要管理者管理後台帳號、一般使用者只能用勾選的功能、
管理者有全部功能但不能管帳號、停用與移交、不能繞過權限改管理者密碼、操作紀錄與租戶隔離。
"""

import pytest

from app.core.security import hash_password
from app.models.coach import Coach
from app.models.user import StaffLevel, User, UserRole
from app.services import tenants as tenant_service
from tests.conftest import auth, platform_auth

API = "/api/v1"


@pytest.fixture()
def owner(db):
    u = User(username="boss", password_hash=hash_password("owner-pw-123"), role=UserRole.admin,
             staff_level=StaffLevel.owner)
    db.add(u)
    db.commit()
    return u


def create(client, owner, **body):
    data = {"username": "amy", "display_name": "Amy", "password": "init-pw-123", "level": "一般使用者",
            "permissions": ["reservations"], **body}
    return client.post(f"{API}/staff", json=data, headers=auth(owner))


def login(client, username, password):
    return client.post(f"{API}/auth/login", data={"username": username, "password": password})


def test_meta_lists_menu_permissions_and_templates(client, owner):
    meta = client.get(f"{API}/staff/meta", headers=auth(owner)).json()
    codes = [p["code"] for p in meta["permissions"]]
    assert codes[:3] == ["dashboard", "reservations", "coaches"] and "settings" in codes
    assert {p["code"] for p in meta["permissions"] if p["sensitive"]} == {"coaches", "payouts", "members", "settings"}
    assert [t["label"] for t in meta["templates"]] == ["櫃台", "店長", "會計"]


def test_owner_creates_staff_with_permissions(client, db, owner, member):
    res = create(client, owner, permissions=["reservations", "dashboard", "reservations"])
    assert res.status_code == 201, res.text
    amy = res.json()
    assert amy["level"] == "一般使用者" and amy["permissions"] == ["dashboard", "reservations"]
    assert amy["must_change_password"] is True
    # 帳號和會員共用名稱空間
    assert create(client, owner, username="member").status_code == 409
    assert create(client, owner, username="x", permissions=["nope"]).status_code == 400
    assert create(client, owner, username="y", level="主要管理者").status_code == 422

    token = login(client, "amy", "init-pw-123").json()
    assert token["role"] == "admin" and token["must_change_password"] is True
    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token['access_token']}"}).json()
    assert me["staff"] == {"level": "一般使用者", "permissions": ["dashboard", "reservations"]}
    owner_me = client.get(f"{API}/auth/me", headers=auth(owner)).json()
    assert owner_me["staff"]["level"] == "主要管理者" and len(owner_me["staff"]["permissions"]) == 15
    assert client.get(f"{API}/auth/me", headers=auth(member)).json()["staff"] is None


def test_staff_only_reaches_granted_features(client, db, owner, member):
    amy = db.get(User, create(client, owner).json()["id"])
    coach = Coach(user_id=member.id, name="王教練", phone="0912345678", bank_account="1234567890")
    db.add(coach)
    db.commit()
    h = auth(amy)
    # 沒勾的功能：公休設定、教練鐘點、系統設定、會員修改、後台帳號
    slot = {"slot_date": "2030-01-02", "start_hour": 10, "is_open": False}
    res = client.put(f"{API}/time-slots", json=slot, headers=h)
    assert res.status_code == 403 and "公休設定" in res.json()["detail"]
    assert client.get(f"{API}/coach-payouts/summary", params={"month": "2030-01"}, headers=h).status_code == 403
    assert client.put(f"{API}/system-settings", json={"company_name": "x"}, headers=h).status_code == 403
    assert client.put(f"{API}/users/{member.id}", json={"display_name": "x"}, headers=h).status_code == 403
    assert client.get(f"{API}/staff", headers=h).status_code == 403
    # 有「預約審核」：會員清單可以讀（下拉選單用），教練的電話與匯款帳號看不到
    assert client.get(f"{API}/users", headers=h).status_code == 200
    seen = client.get(f"{API}/coaches", headers=h).json()[0]
    assert seen["phone"] is None and seen["bank_account"] is None
    assert client.get(f"{API}/coaches", headers=auth(owner)).json()[0]["phone"] == "0912345678"

    # 權限立即生效，不用重新登入
    client.put(f"{API}/staff/{amy.id}", json={"permissions": ["reservations", "availability"]}, headers=auth(owner))
    assert client.put(f"{API}/time-slots", json=slot, headers=h).status_code == 200


def test_manager_has_everything_but_accounts(client, db, owner, member):
    amy_id = create(client, owner).json()["id"]
    res = client.put(f"{API}/staff/{amy_id}", json={"level": "管理者"}, headers=auth(owner))
    assert res.status_code == 200 and res.json()["level"] == "管理者" and len(res.json()["permissions"]) == 15
    amy = db.get(User, amy_id)
    h = auth(amy)
    assert client.put(f"{API}/time-slots", json={"slot_date": "2030-01-02", "start_hour": 10, "is_open": False},
                      headers=h).status_code == 200
    assert client.get(f"{API}/coach-payouts/summary", params={"month": "2030-01"}, headers=h).status_code == 200
    assert client.get(f"{API}/staff", headers=h).status_code == 403  # 只有主要管理者管帳號
    assert client.post(f"{API}/staff", json={"username": "z", "password": "init-pw-123"}, headers=h).status_code == 403
    # 管理者不需要勾功能；降回一般使用者後沒有任何功能
    assert client.put(f"{API}/staff/{amy_id}", json={"permissions": ["dashboard"]}, headers=auth(owner)).status_code == 400
    res = client.put(f"{API}/staff/{amy_id}", json={"level": "一般使用者"}, headers=auth(owner))
    assert res.json()["level"] == "一般使用者" and res.json()["permissions"] == ["reservations"]


def test_owner_is_protected_and_disable_blocks_login(client, db, owner):
    amy_id = create(client, owner).json()["id"]
    h = auth(owner)
    assert client.put(f"{API}/staff/{owner.id}", json={"level": "管理者"}, headers=h).status_code == 400
    assert client.post(f"{API}/staff/{owner.id}/status", json={"is_active": False}, headers=h).status_code == 400
    assert client.post(f"{API}/staff/{owner.id}/reset-password", json={"new_password": "abcdefgh"},
                       headers=h).status_code == 400

    amy = db.get(User, amy_id)
    amy_headers = auth(amy)
    res = client.post(f"{API}/staff/{amy_id}/status", json={"is_active": False}, headers=h)
    assert res.status_code == 200 and res.json()["is_active"] is False
    assert login(client, "amy", "init-pw-123").status_code == 403  # 不能登入
    assert client.get(f"{API}/auth/me", headers=amy_headers).status_code == 403  # 已登入的也失效
    client.post(f"{API}/staff/{amy_id}/status", json={"is_active": True}, headers=h)
    res = client.post(f"{API}/staff/{amy_id}/reset-password", json={"new_password": "new-pw-456"}, headers=h)
    assert res.status_code == 200 and res.json()["must_change_password"] is True
    assert login(client, "amy", "new-pw-456").status_code == 200


def test_member_endpoints_cannot_touch_staff_accounts(client, db, owner):
    """有「會員管理」權限也不能透過會員 API 重設後台帳號的密碼。"""
    amy = db.get(User, create(client, owner, permissions=["members"]).json()["id"])
    res = client.post(f"{API}/users/{owner.id}/reset-password", json={"new_password": "hacked-123"}, headers=auth(amy))
    assert res.status_code == 404
    assert client.put(f"{API}/users/{owner.id}/blacklist", json={"is_blacklisted": True},
                      headers=auth(amy)).status_code == 404


def test_transfer_owner(client, db, owner):
    amy_id = create(client, owner).json()["id"]
    h = auth(owner)
    bad = client.post(f"{API}/staff/transfer-owner", json={"user_id": amy_id, "password": "wrong"}, headers=h)
    assert bad.status_code == 400
    res = client.post(f"{API}/staff/transfer-owner", json={"user_id": amy_id, "password": "owner-pw-123"}, headers=h)
    assert res.status_code == 200 and res.json()["level"] == "主要管理者"
    db.refresh(owner)
    assert owner.staff_level == StaffLevel.manager
    assert client.get(f"{API}/staff", headers=h).status_code == 403
    amy = db.get(User, amy_id)
    assert client.get(f"{API}/staff", headers=auth(amy)).status_code == 200

    logs = client.get(f"{API}/staff/logs", headers=auth(amy)).json()
    assert [entry["action"] for entry in logs] == ["移交主要管理者", "新增帳號"]
    assert logs[0]["actor_name"] == "boss" and logs[0]["target_name"] == "Amy"


def test_audit_log_records_permission_changes(client, owner):
    amy_id = create(client, owner).json()["id"]
    client.put(f"{API}/staff/{amy_id}", json={"permissions": ["dashboard", "payouts"]}, headers=auth(owner))
    log = client.get(f"{API}/staff/logs", headers=auth(owner)).json()[0]
    assert log["action"] == "修改權限"
    assert log["detail"] == "開啟 儀表板、教練鐘點；關閉 預約審核"


def test_earliest_admin_becomes_owner_when_missing(client, db, admin):
    """舊資料沒有主要管理者：最早建立的管理員第一次打開「後台帳號」時自動成為主要管理者。"""
    assert admin.staff_level is None
    assert client.get(f"{API}/staff", headers=auth(admin)).status_code == 200
    db.refresh(admin)
    assert admin.staff_level == StaffLevel.owner


def test_tenant_isolation(client, beta_client, owner, beta_admin):
    amy_id = create(client, owner).json()["id"]
    beta_list = beta_client.get(f"{API}/staff", headers=auth(beta_admin)).json()
    assert [s["username"] for s in beta_list] == ["admin"]
    assert beta_client.put(f"{API}/staff/{amy_id}", json={"level": "管理者"},
                           headers=auth(beta_admin)).status_code == 404


def test_platform_first_admin_is_owner(platform_client, platform_admin, platform_db):
    body = {"subdomain": "delta-fit", "name": "Delta 健身", "timezone": "Asia/Taipei",
            "admin_username": "boss", "admin_password": "init-pw-123"}
    gym = platform_client.post(f"{API}/platform/tenants", json=body, headers=platform_auth(platform_admin)).json()
    platform_client.post(f"{API}/platform/tenants/{gym['id']}/admins",
                         json={"username": "second", "password": "init-pw-456"}, headers=platform_auth(platform_admin))
    admins = tenant_service.tenant_admins(platform_db, gym["id"])
    assert [(a.username, a.staff_level) for a in admins] == [("boss", StaffLevel.owner), ("second", StaffLevel.manager)]

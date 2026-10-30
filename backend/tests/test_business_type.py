"""
行業類型（ADR 0011、R48–R49）：健身／美體切換用詞、美體店預設關閉團體課程（可在系統設定打開）、
形象網站與通知用對應的用詞、平台開通與修改行業類型。
"""

import time

import pytest

from app import deps
from app.core.tenant_context import TenantInfo
from app.models.inquiry import Inquiry
from app.models.tenant import TenantStatus
from app.services import terms
from tests.conftest import auth, platform_auth

API = "/api/v1"


@pytest.fixture()
def beauty(tenants):
    """把 alpha 當成美體店（直接放進租戶快取；測試的 app 連線不能改 tenants 表）。"""
    info = TenantInfo(id=tenants["alpha"], subdomain="alpha", timezone="Asia/Taipei", business_type="beauty")
    deps._tenant_cache["alpha"] = (time.monotonic(), info, TenantStatus.active)
    yield info
    deps.clear_tenant_cache()


def test_terms_tables_have_the_same_keys():
    assert set(terms.TERMS["fitness"]) == set(terms.TERMS["beauty"])
    assert terms.TERMS["beauty"]["staff"] == "美容師" and terms.TERMS["beauty"]["unit"] == "次"


def test_fitness_profile_by_default(client, admin):
    # 還沒有系統設定時用平台開通時的名稱
    assert client.get(f"{API}/tenant/profile").json() == {
        "name": "Alpha 健身", "business_type": "健身", "group_classes_enabled": True}
    s = client.get(f"{API}/system-settings", headers=auth(admin)).json()
    assert s["company_name"] == "健身工作室管理系統" and s["group_classes_enabled"] is True
    labels = {p["code"]: p["label"] for p in client.get(f"{API}/staff/meta", headers=auth(admin)).json()["permissions"]}
    assert labels["coaches"] == "教練管理" and labels["payouts"] == "教練鐘點" and labels["courses"] == "課程管理"


def test_beauty_terms_and_group_classes_switch(client, admin, beauty):
    # 不需登入也讀得到（登入頁、LINE 加入會員頁用）
    assert client.get(f"{API}/tenant/profile").json()["business_type"] == "美體"
    assert client.get(f"{API}/tenant/profile").json()["group_classes_enabled"] is False
    s = client.get(f"{API}/system-settings", headers=auth(admin)).json()
    assert s["company_name"] == "美體工作室管理系統" and s["group_classes_enabled"] is False
    labels = {p["code"]: p["label"] for p in client.get(f"{API}/staff/meta", headers=auth(admin)).json()["permissions"]}
    assert labels["coaches"] == "美容師管理" and labels["payouts"] == "美容師服務費" and labels["courses"] == "團體課程管理"

    # 在系統設定打開團體課程
    res = client.put(f"{API}/system-settings", json={"group_classes_enabled": True}, headers=auth(admin))
    assert res.status_code == 200 and res.json()["group_classes_enabled"] is True
    assert client.get(f"{API}/tenant/profile").json()["group_classes_enabled"] is True
    # 沒帶這個欄位的修改不影響開關；名稱用系統設定的簡稱
    client.put(f"{API}/system-settings", json={"short_name": "小美"}, headers=auth(admin))
    profile = client.get(f"{API}/tenant/profile").json()
    assert profile["group_classes_enabled"] is True and profile["name"] == "小美"
    client.put(f"{API}/system-settings", json={"short_name": "", "company_name": "小美美體館"}, headers=auth(admin))
    assert client.get(f"{API}/tenant/profile").json()["name"] == "小美美體館"


def test_beauty_website_and_notifications(client, db, admin, beauty):
    site = client.get(f"{API}/website", headers=auth(admin)).json()["draft"]
    assert site["coaches"]["title"] == "美容師團隊" and site["trial"]["title"] == "預約體驗療程"
    assert site["trial"]["interests"] == ["個人療程", "還不確定，想先諮詢"]
    assert "安排體驗療程" in site["trial"]["privacy_notice"]
    assert next(s for s in site["sections"] if s["key"] == "schedule")["visible"] is False
    assert client.post(f"{API}/website/publish", headers=auth(admin)).status_code == 200

    html = client.get("/").text
    assert "預約體驗療程" in html and "體驗課" not in html and "HealthAndBeautyBusiness" in html
    assert 'href="#schedule"' not in html

    form = {"name": "林小芳", "phone": "0922333444", "consent": "on"}
    assert client.post("/site/inquiry", data=form, follow_redirects=False).status_code == 303
    note = client.get(f"{API}/notifications", headers=auth(admin)).json()["items"][0]
    assert note["title"] == "新的體驗療程詢問"
    assert db.query(Inquiry).count() == 1


def test_fitness_website_keeps_fitness_words(client, admin):
    client.get(f"{API}/website", headers=auth(admin))
    client.post(f"{API}/website/publish", headers=auth(admin))
    html = client.get("/").text
    assert "預約體驗課" in html and "ExerciseGym" in html


def test_shop_name_in_titles(client, admin):
    """形象網站與分頁標題用同一個店名；系統設定的預設公司名稱不算店名。"""
    client.get(f"{API}/system-settings", headers=auth(admin))  # 建立預設設定（公司名稱＝健身工作室管理系統）
    assert client.get(f"{API}/tenant/profile").json()["name"] == "Alpha 健身"
    client.get(f"{API}/website", headers=auth(admin))
    client.post(f"{API}/website/publish", headers=auth(admin))
    assert "<title>Alpha 健身</title>" in client.get("/").text

    client.put(f"{API}/system-settings", json={"company_name": "阿法運動中心", "short_name": "阿法"}, headers=auth(admin))
    assert client.get(f"{API}/tenant/profile").json()["name"] == "阿法"
    html = client.get("/").text
    assert "<title>阿法運動中心</title>" in html and '"name": "阿法運動中心"' in html

    draft = client.get(f"{API}/website", headers=auth(admin)).json()["draft"]
    draft["seo"]["title"] = "阿法｜桃園健身房"
    client.put(f"{API}/website/draft", json=draft, headers=auth(admin))
    client.post(f"{API}/website/publish", headers=auth(admin))
    assert "<title>阿法｜桃園健身房</title>" in client.get("/").text
    token = client.post(f"{API}/website/preview-token", headers=auth(admin)).json()["token"]
    assert "<title>（預覽）阿法｜桃園健身房</title>" in client.get(f"/site/preview?token={token}").text


def test_platform_sets_business_type(platform_client, platform_admin):
    body = {"subdomain": "spa-one", "name": "一號美體", "timezone": "Asia/Taipei", "business_type": "美體",
            "admin_username": "boss", "admin_password": "init-pw-123"}
    res = platform_client.post(f"{API}/platform/tenants", json=body, headers=platform_auth(platform_admin))
    assert res.status_code == 201, res.text
    gym = res.json()
    assert gym["business_type"] == "美體"
    res = platform_client.put(f"{API}/platform/tenants/{gym['id']}", json={"business_type": "健身"},
                              headers=platform_auth(platform_admin))
    assert res.json()["business_type"] == "健身"
    logs = platform_client.get(f"{API}/platform/audit-logs", params={"tenant_id": gym["id"]},
                               headers=platform_auth(platform_admin)).json()
    assert any(log["action"] == "update_tenant" and "business_type" in str(log["detail"]) for log in logs)

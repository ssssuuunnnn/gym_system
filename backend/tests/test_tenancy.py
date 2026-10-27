"""
多租戶隔離（ADR 0001）：每家健身房只能看到、改到自己的資料。
"""

from datetime import datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core import clock
from app.core.tenant_context import TenantInfo, current_tenant
from app.db.session import Base
from app.models.platform import PLATFORM_TABLE_NAMES
from app.models.product import Product, ProductCategory
from app.models.tenant import Tenant, TenantMixin
from tests.conftest import auth


# ---------- 結構：每張業務表都有 tenant_id 與 RLS ----------


def _tenant_tables() -> set[str]:
    return {m.class_.__tablename__ for m in Base.registry.mappers if issubclass(m.class_, TenantMixin)}


def test_every_business_table_is_tenant_scoped():
    """除平台表（tenants、platform_*）外，每張資料表都要繼承 TenantMixin（新增資料表時忘了會在這裡失敗）。"""
    all_tables = set(Base.metadata.tables) - PLATFORM_TABLE_NAMES
    assert all_tables == _tenant_tables()


def test_every_tenant_table_has_rls_policy(connection):
    rows = connection.execute(
        text(
            "SELECT c.relname, c.relrowsecurity, "
            "EXISTS (SELECT 1 FROM pg_policies p WHERE p.tablename = c.relname AND p.policyname = 'tenant_isolation') "
            "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'public' AND c.relkind = 'r'"
        )
    ).all()
    status = {name: (rls, has_policy) for name, rls, has_policy in rows}
    for table in _tenant_tables():
        assert status[table] == (True, True), f"{table} 沒有啟用 RLS（migration 要呼叫 enable_tenant_rls）"


def test_app_role_is_not_superuser_or_bypassrls(connection):
    """應用程式帳號若能略過 RLS，隔離就形同虛設。"""
    row = connection.execute(
        text("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
    ).one()
    assert tuple(row) == (False, False)


# ---------- 資料庫層：沒設定租戶就什麼都看不到、寫不進別家 ----------


def test_without_tenant_nothing_is_visible(connection, db):
    db.add(Product(name="A 方案", category=ProductCategory.single_course, session_hours=1, price=100))
    db.commit()
    with connection.begin_nested():
        connection.execute(text("SELECT set_config('app.tenant_id', '', true)"))
        assert connection.execute(text("SELECT count(*) FROM products")).scalar() == 0


def test_cannot_write_other_tenants_id(connection, db, tenants):
    """就算程式手動指定別家的 tenant_id，RLS 的 WITH CHECK 也會擋下。"""
    db.add(
        Product(
            name="偷塞", category=ProductCategory.single_course, session_hours=1, price=1, tenant_id=tenants["beta"]
        )
    )
    with pytest.raises(DBAPIError, match="row-level security"):
        db.commit()
    db.rollback()


def test_tenants_table_is_read_only_for_app(connection):
    with connection.begin_nested() as sp:
        with pytest.raises(DBAPIError, match="permission denied"):
            connection.execute(text("INSERT INTO tenants (name, subdomain) VALUES ('x', 'x')"))
        sp.rollback()


# ---------- API 層：子網域決定租戶 ----------


def test_products_are_isolated(client, beta_client, admin, beta_admin):
    res = client.post(
        "/api/v1/products",
        json={"name": "Alpha 10 堂", "category": "課程", "session_hours": 10, "price": 1000},
        headers=auth(admin),
    )
    assert res.status_code == 201, res.text
    product_id = res.json()["id"]

    assert beta_client.get("/api/v1/products", headers=auth(beta_admin)).json() == []
    res = beta_client.put(
        f"/api/v1/products/{product_id}", json={"name": "改掉"}, headers=auth(beta_admin)
    )
    assert res.status_code == 404
    assert client.get("/api/v1/products", headers=auth(admin)).json()[0]["name"] == "Alpha 10 堂"


def test_cannot_reference_other_tenants_rows(client, beta_db, admin, member):
    """把別家的商品 id 拿來建立購買紀錄：看不到 → 找不到。"""
    # 測試的各 Session 共用同一條連線（同一個交易），切到 beta 前先取好 alpha 的值
    member_id, headers = member.id, auth(admin)
    other = Product(name="Beta 方案", category=ProductCategory.single_course, session_hours=5, price=500)
    beta_db.add(other)
    beta_db.commit()
    res = client.post(
        "/api/v1/purchases",
        json={
            "user_id": member_id,
            "product_id": other.id,
            "quantity": 1,
            "amount": 500,
            "purchase_date": "2026-10-24",
            "payment_method": "現金",
        },
        headers=headers,
    )
    assert res.status_code in (400, 404), res.text


def test_token_from_other_tenant_is_rejected(beta_client, admin):
    res = beta_client.get("/api/v1/auth/me", headers=auth(admin))
    assert res.status_code == 401


def test_same_username_in_two_tenants(client, beta_client):
    for c in (client, beta_client):
        res = c.post("/api/v1/auth/register", json={"username": "amy", "password": "secret123"})
        assert res.status_code == 201, res.text
    # 同一家不能重複
    res = client.post("/api/v1/auth/register", json={"username": "amy", "password": "secret123"})
    assert res.status_code == 400

    res = client.post("/api/v1/auth/login", data={"username": "amy", "password": "secret123"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    assert beta_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_system_settings_are_per_tenant(client, beta_client, admin, beta_admin):
    res = client.put("/api/v1/system-settings", json={"company_name": "Alpha 健身"}, headers=auth(admin))
    assert res.status_code == 200, res.text
    assert beta_client.get("/api/v1/system-settings", headers=auth(beta_admin)).json()["company_name"] != "Alpha 健身"


def test_unknown_subdomain_is_404(db):
    from fastapi.testclient import TestClient

    from app.main import app

    res = TestClient(app, base_url="http://nope.localhost").get("/api/v1/products")
    assert res.status_code == 404


def test_suspended_tenant_is_403(client, admin, owner_engine, tenants):
    from app import deps

    with owner_engine.begin() as conn:
        conn.execute(text("UPDATE tenants SET status = 'suspended' WHERE subdomain = 'alpha'"))
    try:
        deps.clear_tenant_cache()
        res = client.get("/api/v1/products", headers=auth(admin))
        assert res.status_code == 403
    finally:
        with owner_engine.begin() as conn:
            conn.execute(text("UPDATE tenants SET status = 'active' WHERE subdomain = 'alpha'"))
        deps.clear_tenant_cache()


def test_media_is_saved_per_tenant(client, admin, tmp_path, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "MEDIA_DIR", str(tmp_path))
    res = client.post(
        "/api/v1/system-settings/upload-logo",
        files={"file": ("logo.png", b"\x89PNG\r\n", "image/png")},
        headers=auth(admin),
    )
    assert res.status_code == 200, res.text
    url = res.json()["url"]
    assert url.startswith("/media/alpha/system/")
    assert (tmp_path / url.removeprefix("/media/")).exists()


def test_clock_uses_tenant_timezone():
    token = current_tenant.set(TenantInfo(id=1, subdomain="x", timezone="America/New_York"))
    try:
        ny = clock.now_local()
    finally:
        current_tenant.reset(token)
    taipei = clock.now_local()
    assert isinstance(ny, datetime)
    # 台北與紐約相差 12 或 13 小時
    assert round((taipei - ny).total_seconds() / 3600) in (12, 13)


def test_tenant_model_has_no_rls():
    assert not issubclass(Tenant, TenantMixin)

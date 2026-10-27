"""
測試共用設定：在真的 PostgreSQL 上執行（RLS 是 PostgreSQL 功能，見 ADR 0001）。

- 整個測試階段開始時，以 owner 身份把測試資料庫 migrate 到最新，並建立兩家健身房 alpha / beta。
- 應用程式與測試都以 fitness_app（受 RLS 限制）連線，所以測試同時驗證了租戶隔離。
- 每個測試包在一個外層交易裡，結束後回滾；路由裡的 commit 只會釋放 savepoint。
- client 預設打 alpha 的網址（http://alpha.localhost）；beta_client 打 beta。

- 平台管理後台的測試用 platform_client（http://platform.localhost），以平台帳號連線，同樣每個測試回滾。

連線字串可用環境變數覆寫：TEST_DATABASE_URL（app 帳號）、TEST_MIGRATION_DATABASE_URL（owner 帳號）、
TEST_PLATFORM_DATABASE_URL（平台帳號）。
"""

import os

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://fitness_app:app_pw@localhost:5432/fitness_test"
)
TEST_MIGRATION_DATABASE_URL = os.environ.get(
    "TEST_MIGRATION_DATABASE_URL", "postgresql+psycopg://fitness_owner:owner_pw@localhost:5432/fitness_test"
)
TEST_PLATFORM_DATABASE_URL = os.environ.get(
    "TEST_PLATFORM_DATABASE_URL", "postgresql+psycopg://fitness_platform:platform_pw@localhost:5432/fitness_test"
)
# 必須在匯入 app 之前設定，讓 settings 指向測試資料庫
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["PLATFORM_DATABASE_URL"] = TEST_PLATFORM_DATABASE_URL
os.environ["MIGRATION_DATABASE_URL"] = TEST_MIGRATION_DATABASE_URL
os.environ["BASE_DOMAIN"] = "localhost"
# LINE 通知：測試用的假金鑰（實際呼叫由 tests/test_line.py 的假 client 攔下），不啟動背景重試
os.environ["LINE_CHANNEL_SECRET"] = "test-line-secret"
os.environ["LINE_CHANNEL_ACCESS_TOKEN"] = "test-line-token"
os.environ["LINE_BOT_BASIC_ID"] = "@testbot"
os.environ["LINE_DISPATCH_INTERVAL_SECONDS"] = "0"
os.environ["DEFAULT_TENANT"] = ""

from pathlib import Path  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event, text  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

import app.models  # noqa: E402,F401  確保所有資料表都註冊到 Base.metadata
from app import deps  # noqa: E402
from app.core.security import create_access_token, create_platform_token, hash_password  # noqa: E402
from app.db import session as db_session  # noqa: E402
from app.db.session import TENANT_INFO_KEY  # noqa: E402
from app.main import app  # noqa: E402
from app.models.platform import PlatformAdmin  # noqa: E402
from app.models.product import Product, ProductCategory  # noqa: E402
from app.models.tenant import Tenant, TenantStatus  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session")
def owner_engine():
    engine = create_engine(TEST_MIGRATION_DATABASE_URL)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def tenants(owner_engine):
    """把測試資料庫重建到最新 migration，並建立 alpha / beta 兩家健身房。回傳 {subdomain: id}。"""
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    with Session(owner_engine) as s:
        rows = [
            Tenant(subdomain="alpha", name="Alpha 健身", status=TenantStatus.active),
            Tenant(subdomain="beta", name="Beta 健身", status=TenantStatus.active),
        ]
        s.add_all(rows)
        s.commit()
        return {t.subdomain: t.id for t in rows}


@pytest.fixture(scope="session")
def app_engine(tenants):
    engine = create_engine(TEST_DATABASE_URL)
    yield engine
    engine.dispose()


@pytest.fixture()
def connection(app_engine, monkeypatch):
    """每個測試一個外層交易；應用程式的 Session 全部綁在這條連線上，結束後整個回滾。"""
    conn = app_engine.connect()
    trans = conn.begin()
    TestingSession = sessionmaker(
        bind=conn, autoflush=False, autocommit=False, join_transaction_mode="create_savepoint"
    )
    monkeypatch.setattr(db_session, "SessionLocal", TestingSession)
    deps.clear_tenant_cache()

    # 測試裡所有 Session 共用這一條連線（同一個交易），set_config 是整條連線共用的：
    # 某個 Session 交易還開著時，另一家的 Session 可能已把租戶切走。正式環境每個請求各一條連線，沒有這個問題。
    # 這裡在每次查詢與寫入前，重新套用該 Session 自己的租戶。
    def _apply_tenant(session):
        tenant_id = session.info.get(TENANT_INFO_KEY)
        if tenant_id is not None and session.get_bind() is conn:
            conn.execute(text("SELECT set_config('app.tenant_id', :tid, true)"), {"tid": str(tenant_id)})

    def _on_execute(state):
        _apply_tenant(state.session)

    def _on_flush(session, flush_context, instances):
        _apply_tenant(session)

    event.listen(Session, "do_orm_execute", _on_execute)
    event.listen(Session, "before_flush", _on_flush)
    try:
        yield conn
    finally:
        event.remove(Session, "do_orm_execute", _on_execute)
        event.remove(Session, "before_flush", _on_flush)
        trans.rollback()
        conn.close()
        deps.clear_tenant_cache()


def _tenant_db(connection, tenant_id: int):
    """
    測試準備資料用的 Session。commit 後不讓物件過期（expire_on_commit=False），
    之後讀屬性就不會再開新的 savepoint 掛著——兩家的 Session 交錯時，掛著的 savepoint 會亂掉順序。
    """
    s = Session(bind=connection, autoflush=False, join_transaction_mode="create_savepoint", expire_on_commit=False)
    s.info[TENANT_INFO_KEY] = tenant_id
    return s


@pytest.fixture()
def db(connection, tenants):
    """alpha 的資料庫 Session（測試準備資料用）。"""
    s = _tenant_db(connection, tenants["alpha"])
    yield s
    s.close()


@pytest.fixture()
def beta_db(connection, tenants):
    s = _tenant_db(connection, tenants["beta"])
    yield s
    s.close()


@pytest.fixture()
def client(db):
    return TestClient(app, base_url="http://alpha.localhost")


@pytest.fixture()
def beta_client(beta_db):
    return TestClient(app, base_url="http://beta.localhost")


def _make_user(db, username: str, role: UserRole) -> User:
    user = User(username=username, password_hash=hash_password("pw"), role=role)
    db.add(user)
    db.commit()
    return user


def auth(user: User) -> dict:
    token = create_access_token(user_id=user.id, tenant_id=user.tenant_id, role=user.role.value, is_coach=False)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin(db):
    return _make_user(db, "admin", UserRole.admin)


@pytest.fixture()
def member(db):
    return _make_user(db, "member", UserRole.member)


@pytest.fixture()
def other_member(db):
    return _make_user(db, "other", UserRole.member)


@pytest.fixture()
def beta_admin(beta_db):
    return _make_user(beta_db, "admin", UserRole.admin)


@pytest.fixture()
def pack(db):
    """10 堂的「課程」（單次課程）方案。"""
    product = Product(name="私人課 10 堂", category=ProductCategory.single_course, session_hours=10, price=10000)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@pytest.fixture()
def supply(db):
    product = Product(name="乳清", category=ProductCategory.supply, session_hours=0, stock=5, price=1200)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


# ---------- 平台管理後台 ----------


@pytest.fixture(scope="session")
def platform_engine(tenants):
    engine = create_engine(TEST_PLATFORM_DATABASE_URL)
    yield engine
    engine.dispose()


@pytest.fixture()
def platform_connection(platform_engine, connection, monkeypatch):
    """平台帳號的外層交易，結束後回滾（與 connection 是兩條不同連線，彼此看不到未提交的資料）。"""
    conn = platform_engine.connect()
    trans = conn.begin()
    monkeypatch.setattr(
        db_session,
        "PlatformSessionLocal",
        sessionmaker(bind=conn, autoflush=False, autocommit=False, join_transaction_mode="create_savepoint"),
    )
    try:
        yield conn
    finally:
        trans.rollback()
        conn.close()


@pytest.fixture()
def platform_db(platform_connection):
    s = db_session.PlatformSessionLocal()
    yield s
    s.close()


@pytest.fixture()
def platform_client(platform_connection):
    return TestClient(app, base_url="http://platform.localhost")


@pytest.fixture()
def platform_admin(platform_db):
    admin = PlatformAdmin(username="ops", password_hash=hash_password("platform-pw"))
    platform_db.add(admin)
    platform_db.commit()
    platform_db.refresh(admin)
    return admin


def platform_auth(admin: PlatformAdmin) -> dict:
    return {"Authorization": f"Bearer {create_platform_token(admin_id=admin.id)}"}

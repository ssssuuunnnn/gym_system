"""
測試共用設定：每個測試一個全新的 in-memory SQLite，透過 dependency override 取代 get_db。
以 create_all 建表（不跑 Alembic），速度快且彼此隔離。
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  確保所有資料表都註冊到 Base.metadata
from app.core.security import create_access_token, hash_password
from app.db.session import Base, get_db
from app.main import app
from app.models.product import Product, ProductCategory
from app.models.user import User, UserRole


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()

    def _override():
        s = TestingSession()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _override
    try:
        yield session
    finally:
        session.close()
        app.dependency_overrides.clear()
        engine.dispose()


@pytest.fixture()
def client(db):
    return TestClient(app)


def _make_user(db, username: str, role: UserRole) -> User:
    user = User(username=username, password_hash=hash_password("pw"), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth(user: User) -> dict:
    token = create_access_token(user_id=user.id, role=user.role.value, is_coach=False)
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

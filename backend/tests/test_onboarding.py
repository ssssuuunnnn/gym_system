"""
開店設定清單（ADR 0016、R65）：依實際資料判斷每一步，範例資料不算，隱藏／重新顯示，權限。
"""

from app.core.security import hash_password
from app.models.coach import Coach
from app.models.line_oa import LineOaChannel
from app.models.product import Product, ProductCategory
from app.models.system_settings import SystemSettings
from app.models.user import StaffLevel, User, UserRole
from app.models.website import Website
from tests.conftest import auth

API = "/api/v1/onboarding"


def _state(client, admin):
    res = client.get(API, headers=auth(admin))
    assert res.status_code == 200, res.text
    body = res.json()
    return body, {s["key"]: s["done"] for s in body["steps"]}


def _user(db, name, role=UserRole.member):
    u = User(username=name, password_hash=hash_password("pw"), role=role)
    db.add(u)
    db.commit()
    return u


def test_steps_follow_real_data(client, db, admin):
    body, done = _state(client, admin)
    assert [s["key"] for s in body["steps"]] == ["profile", "payment", "staff", "plans", "website", "members", "line"]
    assert not any(done.values()) and body["done_count"] == 0 and body["required_count"] == 6
    assert body["steps"][-1]["optional"] is True and body["completed"] is False

    # 預設公司名稱不算店名；要有自己的名稱＋LOGO
    db.add(SystemSettings(company_name="健身工作室管理系統", logo_url="/media/alpha/system/x.png"))
    db.commit()
    assert _state(client, admin)[1]["profile"] is False
    row = db.query(SystemSettings).first()
    row.company_name = "Alpha 健身"
    row.payment_instructions = "  "
    db.commit()
    _, done = _state(client, admin)
    assert done["profile"] is True and done["payment"] is False
    row.payment_instructions = "轉帳 812-1234"
    db.commit()

    coach_user = _user(db, "coach1")
    db.add(Coach(user_id=coach_user.id, name="Alex", phone="0900"))
    db.add(Product(name="用品", category=ProductCategory.supply, session_hours=0, price=100, stock=3))
    db.commit()
    _, done = _state(client, admin)
    assert done["payment"] and done["staff"]
    assert done["plans"] is False  # 用品不算方案
    assert done["members"] is False  # 綁定教練的帳號不算會員

    db.add(Product(name="私人課 10 堂", category=ProductCategory.single_course, session_hours=10, price=12000))
    _user(db, "member1")
    db.add(Website(draft={}, published={"theme": "bold"}))
    db.commit()
    body, done = _state(client, admin)
    assert done["plans"] and done["members"] and done["website"]
    assert body["completed"] is True and body["done_count"] == 6
    assert done["line"] is False  # 選做，不影響完成

    db.add(LineOaChannel(is_enabled=True, channel_secret_enc="x", access_token_enc="x", login_channel_id="1", liff_id="1-a"))
    db.commit()
    assert _state(client, admin)[1]["line"] is True


def test_sample_data_does_not_count(client, db, admin):
    sample_user = _user(db, "sample-staff1")
    other = _user(db, "sample-member")
    coach = Coach(user_id=sample_user.id, name="範例教練", phone="0900")
    plan = Product(name="範例方案", category=ProductCategory.single_course, session_hours=1, price=600)
    db.add_all([coach, plan])
    db.commit()
    db.add(SystemSettings(
        company_name="Alpha 健身",
        sample_data={"users": [sample_user.id, other.id], "coaches": [coach.id], "products": [plan.id], "courses": []},
    ))
    db.commit()
    _, done = _state(client, admin)
    assert done["staff"] is False and done["plans"] is False and done["members"] is False

    # 清除範例資料後（sample_data 清空），留下來的就算店家自己的
    db.query(SystemSettings).first().sample_data = None
    db.commit()
    _, done = _state(client, admin)
    assert done["staff"] and done["plans"] and done["members"]


def test_dismiss_and_restore(client, db, admin):
    res = client.post(f"{API}/dismiss", headers=auth(admin))
    assert res.status_code == 200 and res.json()["dismissed"] is True
    row = db.query(SystemSettings).first()
    db.refresh(row)
    assert row.onboarding_dismissed_by == admin.username
    assert _state(client, admin)[0]["dismissed"] is True
    res = client.post(f"{API}/restore", headers=auth(admin))
    assert res.json()["dismissed"] is False


def test_permissions(client, db, admin, member):
    assert client.get(API, headers=auth(member)).status_code == 403
    clerk = _user(db, "clerk", role=UserRole.admin)
    clerk.staff_level = StaffLevel.staff
    clerk.permissions = ["dashboard", "reservations"]
    db.commit()
    assert client.get(API, headers=auth(clerk)).status_code == 403
    assert client.post(f"{API}/dismiss", headers=auth(clerk)).status_code == 403
    clerk.permissions = ["dashboard", "settings"]
    db.commit()
    assert client.get(API, headers=auth(clerk)).status_code == 200

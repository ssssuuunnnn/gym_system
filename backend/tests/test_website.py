"""
形象網站與體驗課詢問（ADR 0003）：草稿／發布、公開欄位白名單、驗證、表單防垃圾、租戶隔離、轉成會員、個資保存期限。
"""

import re
from datetime import date, datetime, timedelta

import pytest

from app.core import clock
from app.core.security import create_site_preview_token, hash_password
from app.models.coach import Coach
from app.models.course import Course, CourseSession, CourseStatus, SessionSource
from app.models.inquiry import Inquiry, InquiryStatus
from app.models.product import Product, ProductCategory
from app.models.system_settings import SystemSettings
from app.models.user import User, UserRole
from tests.conftest import auth

API = "/api/v1"
SECRET_PHONE = "0912999888"
SECRET_BANK = "8888777766665555"
SECRET_LINE = "secret-coach-line"


@pytest.fixture(autouse=True)
def fixed_now(monkeypatch):
    monkeypatch.setattr(clock, "now_local", lambda: datetime(2030, 1, 1, 9, 0))


@pytest.fixture()
def gym(db):
    db.add(SystemSettings(company_name="PulseFit 健身工作室"))
    db.commit()


@pytest.fixture()
def coach(db):
    u = User(username="alex", password_hash=hash_password("pw"), role=UserRole.member)
    db.add(u)
    db.commit()
    c = Coach(
        user_id=u.id,
        name="林子翔",
        alias="Alex 林",
        specialty="增肌減脂・壺鈴",
        phone=SECRET_PHONE,
        line_name=SECRET_LINE,
        bank_code="812",
        bank_account=SECRET_BANK,
        session_rate=1500,
        is_group_coach=True,
    )
    db.add(c)
    db.commit()
    return c


@pytest.fixture()
def hidden_coach(db):
    u = User(username="leo", password_hash=hash_password("pw"), role=UserRole.member)
    db.add(u)
    db.commit()
    c = Coach(user_id=u.id, name="黃大力", alias="Leo 黃", phone="0900", is_rental_coach=True, is_private_coach=False)
    db.add(c)
    db.commit()
    return c


@pytest.fixture()
def plans(db):
    p1 = Product(name="私人課 10 堂", category=ProductCategory.single_course, session_hours=10, price=12000)
    p2 = Product(name="停售方案", category=ProductCategory.single_course, session_hours=5, price=5000, is_active=False)
    db.add_all([p1, p2])
    db.commit()
    return p1, p2


@pytest.fixture()
def course(db, coach):
    c = Course(name="壺鈴循環", coach_id=coach.id, max_capacity=8, status=CourseStatus.on, coach_fee=777)
    c.sessions.append(
        CourseSession(position=0, session_date=date(2030, 1, 2), start_minute=19 * 60, duration_minutes=50,
                      source=SessionSource.scheduled)
    )
    c.sessions.append(
        CourseSession(position=1, session_date=date(2030, 1, 3), start_minute=600, duration_minutes=50,
                      source=SessionSource.scheduled, is_cancelled=True)
    )
    db.add(c)
    db.commit()
    return c


def draft(client, admin):
    res = client.get(f"{API}/website", headers=auth(admin))
    assert res.status_code == 200, res.text
    return res.json()["draft"]


def save(client, admin, content):
    return client.put(f"{API}/website/draft", json=content, headers=auth(admin))


def publish(client, admin):
    res = client.post(f"{API}/website/publish", headers=auth(admin))
    assert res.status_code == 200, res.text
    return res.json()


def full_site(client, admin, coach_id, product_ids):
    content = draft(client, admin)
    content["hero"].update(tagline="小班制訓練，陪你練出改變", description="一對一私人教練與小班團體課。")
    content["about"].update(text="我們是一間小班制工作室。", features=[{"title": "小班制", "text": "8 人以下"}])
    content["coaches"]["items"] = [{"coach_id": coach_id, "bio": "十年肌力訓練經驗"}]
    content["pricing"]["items"] = [{"product_id": pid, "description": "可指定教練"} for pid in product_ids]
    content["faq"]["items"] = [{"q": "要準備什麼？", "a": "運動服與室內鞋。"}]
    content["contact"].update(address="台北市大安區復興南路一段 1 號", phone="02-1234-5678", line="pulsefit",
                              instagram="pulsefit.taipei", facebook="https://www.facebook.com/pulsefit")
    res = save(client, admin, content)
    assert res.status_code == 200, res.text
    return publish(client, admin)


# ---------- 草稿與發布 ----------


def test_unpublished_site_redirects_to_login(client, admin, gym):
    assert draft(client, admin)["seo"]["title"] == "PulseFit 健身工作室"
    res = client.get("/", follow_redirects=False)
    assert res.status_code == 302 and res.headers["location"] == "/login"
    assert "Disallow: /" in client.get("/robots.txt").text
    assert client.get("/sitemap.xml").status_code == 404


def test_published_site_renders_with_seo(client, admin, gym, coach, plans, course):
    full_site(client, admin, coach.id, [plans[0].id])
    res = client.get("/")
    assert res.status_code == 200
    html = res.text
    assert "小班制訓練，陪你練出改變" in html
    assert '<meta property="og:title" content="PulseFit 健身工作室">' in html
    assert '<meta property="og:url" content="http://alpha.localhost/">' in html
    assert '"@type": "ExerciseGym"' in html and "02-1234-5678" in html
    assert "https://line.me/R/ti/p/@pulsefit" in html
    assert "https://www.instagram.com/pulsefit.taipei/" in html
    assert "max-age=60" in res.headers["cache-control"]
    robots = client.get("/robots.txt").text
    assert "Sitemap: http://alpha.localhost/sitemap.xml" in robots
    assert "<loc>http://alpha.localhost/</loc>" in client.get("/sitemap.xml").text


def test_only_public_fields_reach_the_page(client, admin, gym, coach, hidden_coach, plans, course):
    """教練電話、LINE、匯款帳號、鐘點費，課程教練費，一律不能出現在網站上。"""
    full_site(client, admin, coach.id, [plans[0].id, plans[1].id])
    html = client.get("/").text
    for secret in (SECRET_PHONE, SECRET_BANK, SECRET_LINE, "1500", "777", "林子翔"):
        assert secret not in html, secret
    assert "Alex 林" in html and "增肌減脂・壺鈴" in html and "十年肌力訓練經驗" in html
    assert "Leo 黃" not in html  # 沒勾選公開
    assert "12,000" in html and "停售方案" not in html  # 停售的方案不顯示


def test_schedule_and_seats(client, admin, gym, coach, plans, course):
    full_site(client, admin, coach.id, [plans[0].id])
    html = client.get("/").text
    assert "壺鈴循環" in html and "19:00" in html and "剩 8 位" in html
    assert "10:00" not in html.split('id="schedule"')[1].split("</section>")[0]  # 停課的不顯示

    content = draft(client, admin)
    content["schedule"]["show_seats"] = False
    save(client, admin, content)
    publish(client, admin)
    assert "剩 8 位" not in client.get("/").text


def test_sections_order_visibility_and_empty_sections(client, admin, gym, coach, plans, course):
    full_site(client, admin, coach.id, [plans[0].id])
    content = draft(client, admin)
    content["sections"] = [
        {"key": "contact", "visible": True},
        {"key": "hero", "visible": False},  # 必備段落不能關
        {"key": "faq", "visible": False},
    ]
    res = save(client, admin, content)
    keys = [(s["key"], s["visible"]) for s in res.json()["draft"]["sections"]]
    assert keys[:3] == [("contact", True), ("hero", True), ("faq", False)]
    assert len(keys) == 9
    publish(client, admin)
    html = client.get("/").text
    assert 'id="faq"' not in html
    assert html.index('id="contact"') < html.index('id="top"')
    assert 'id="gallery"' not in html  # 沒有照片的段落自動隱藏


def test_draft_preview_and_discard(client, admin, gym, coach, plans, course):
    full_site(client, admin, coach.id, [plans[0].id])
    content = draft(client, admin)
    content["hero"]["tagline"] = "草稿中的新標語"
    state = save(client, admin, content).json()
    assert state["has_unpublished_changes"] is True and state["is_published"] is True
    assert "草稿中的新標語" not in client.get("/").text

    token = client.post(f"{API}/website/preview-token", headers=auth(admin)).json()["token"]
    preview = client.get("/site/preview", params={"token": token})
    assert preview.status_code == 200 and "草稿中的新標語" in preview.text
    assert "noindex" in preview.headers["x-robots-tag"]
    assert client.get("/site/preview", params={"token": "garbage"}).status_code == 403

    state = client.post(f"{API}/website/discard-draft", headers=auth(admin)).json()
    assert state["has_unpublished_changes"] is False
    assert state["draft"]["hero"]["tagline"] == "小班制訓練，陪你練出改變"


def test_unpublish(client, admin, gym, coach, plans, course):
    full_site(client, admin, coach.id, [plans[0].id])
    state = client.post(f"{API}/website/unpublish", headers=auth(admin)).json()
    assert state["is_published"] is False
    assert client.get("/", follow_redirects=False).status_code == 302


def test_text_is_escaped(client, admin, gym, coach, plans, course, db):
    content = draft(client, admin)
    content["hero"]["tagline"] = "<script>alert(1)</script>"
    save(client, admin, content)
    publish(client, admin)
    settings_row = db.query(SystemSettings).first()
    settings_row.company_name = "壞</script><script>alert(2)//"
    db.commit()
    html = client.get("/").text
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
    assert "</script><script>alert(2)" not in html  # JSON-LD 內的 </ 已跳脫


# ---------- 驗證與權限 ----------


@pytest.mark.parametrize(
    "theme, stylesheet, theme_color",
    [("bold", None, "#15181d"), ("airy", "theme-airy.css", "#ffffff"), ("warm", "theme-warm.css", "#faf5ee")],
)
def test_themes(client, admin, gym, coach, plans, course, theme, stylesheet, theme_color):
    """三種版型共用同一份內容與結構，只換外觀；草稿預覽與發布後都套用選到的版型。"""
    full_site(client, admin, coach.id, [plans[0].id])
    content = draft(client, admin)
    assert content["theme"] == "bold"  # 預設
    content["theme"] = theme
    assert save(client, admin, content).status_code == 200
    publish(client, admin)
    html = client.get("/").text
    assert f'<body class="theme-{theme}">' in html
    assert f'<meta name="theme-color" content="{theme_color}">' in html
    assert "小班制訓練，陪你練出改變" in html  # 內容不變
    if stylesheet:
        assert f"/site/static/{stylesheet}" in html
        assert client.get(f"/site/static/{stylesheet}").status_code == 200
    else:
        assert "/site/static/theme-" not in html
    assert ("Noto+Serif+TC" in html) == (theme == "warm")


def test_validation(client, admin, gym, coach):
    content = draft(client, admin)
    bad = {**content, "contact": {**content["contact"], "facebook": "http://evil.example.com"}}
    assert save(client, admin, bad).status_code == 422
    bad = {**content, "contact": {**content["contact"], "line": "javascript:alert(1)"}}
    assert save(client, admin, bad).status_code == 422
    bad = {**content, "brand_color": "#ff0000"}
    assert save(client, admin, bad).status_code == 422
    assert save(client, admin, {**content, "theme": "neon"}).status_code == 422
    other_gym_image = "/media/beta/site/" + "a" * 32 + ".jpg"
    bad = {**content, "hero": {**content["hero"], "image_url": other_gym_image}}
    res = save(client, admin, bad)
    assert res.status_code == 400 and "上傳" in res.json()["detail"]
    bad = {**content, "coaches": {**content["coaches"], "items": [{"coach_id": 999999}]}}
    assert save(client, admin, bad).status_code == 400


def test_upload_image_and_use_it(client, admin, gym, tmp_path, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "MEDIA_DIR", str(tmp_path))
    res = client.post(
        f"{API}/website/upload-image", files={"file": ("a.png", b"\x89PNG\r\n", "image/png")}, headers=auth(admin)
    )
    assert res.status_code == 200, res.text
    url = res.json()["url"]
    assert re.match(r"^/media/alpha/site/[0-9a-f]{32}\.png$", url)
    content = draft(client, admin)
    content["hero"]["image_url"] = url
    assert save(client, admin, content).status_code == 200
    bad = client.post(
        f"{API}/website/upload-image", files={"file": ("a.svg", b"<svg/>", "image/svg+xml")}, headers=auth(admin)
    )
    assert bad.status_code == 400


def test_members_cannot_edit_or_read_inquiries(client, member, gym):
    assert client.get(f"{API}/website", headers=auth(member)).status_code == 403
    assert client.get(f"{API}/inquiries", headers=auth(member)).status_code == 403


def test_preview_token_is_not_a_login_token(client, admin, tenants, beta_client, gym):
    token = create_site_preview_token(tenant_id=tenants["alpha"])
    assert client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    # 別家的預覽 token 不能看這家的草稿
    beta_token = create_site_preview_token(tenant_id=tenants["beta"])
    draft(client, admin)
    assert client.get("/site/preview", params={"token": beta_token}).status_code == 403


def test_unknown_gym_site_is_404_page(db):
    from fastapi.testclient import TestClient

    from app.main import app

    res = TestClient(app, base_url="http://nope.localhost").get("/")
    assert res.status_code == 404 and "找不到這個網站" in res.text


# ---------- 體驗課表單 ----------


FORM = {"name": "王小明", "phone": "0912-345-678", "line_id": "ming", "interest": "私人教練課", "slot": "平日晚上",
        "message": "想改善肩頸", "consent": "on"}


def submit(client, **overrides):
    return client.post("/site/inquiry", data={**FORM, **overrides}, follow_redirects=False)


def test_inquiry_flow(client, admin, gym, coach, plans, course):
    full_site(client, admin, coach.id, [plans[0].id])
    res = submit(client)
    assert res.status_code == 303 and res.headers["location"] == "/?sent=1#trial"
    assert "已收到你的預約" in client.get("/?sent=1").text

    rows = client.get(f"{API}/inquiries", headers=auth(admin)).json()
    assert [(r["name"], r["phone"], r["status"]) for r in rows] == [("王小明", "0912-345-678", "新詢問")]
    assert client.get(f"{API}/inquiries/summary", headers=auth(admin)).json() == {"new_count": 1}

    inquiry_id = rows[0]["id"]
    res = client.post(f"{API}/inquiries/{inquiry_id}/notes", json={"text": "電話未接，已傳 LINE"}, headers=auth(admin))
    assert res.status_code == 201 and res.json()["status"] == "聯絡中"
    assert res.json()["notes"][0]["created_by_name"] == "admin"

    res = client.patch(f"{API}/inquiries/{inquiry_id}", json={"status": "已成為會員"}, headers=auth(admin))
    assert res.status_code == 400  # 要用「建立會員帳號」
    res = client.patch(f"{API}/inquiries/{inquiry_id}", json={"status": "已約體驗"}, headers=auth(admin))
    assert res.json()["status"] == "已約體驗"


def test_inquiry_validation_and_spam_guards(client, admin, gym, coach, plans, course, db):
    full_site(client, admin, coach.id, [plans[0].id])
    res = submit(client, consent="")
    assert res.status_code == 400 and "請勾選同意" in res.text and 'value="王小明"' in res.text
    assert submit(client, phone="abc").status_code == 400
    assert submit(client, interest="不存在的選項").status_code == 400
    assert submit(client, website="http://spam.example.com").status_code == 303  # 機器人：假裝成功
    assert db.query(Inquiry).count() == 0

    for _ in range(3):
        assert submit(client).status_code == 303
    res = submit(client)
    assert res.status_code == 400 and "送出次數太多" in res.text
    assert db.query(Inquiry).count() == 3


def test_inquiry_closed_when_site_offline_or_trial_hidden(client, admin, gym, coach, plans, course):
    draft(client, admin)
    assert submit(client).status_code == 404  # 尚未發布
    full_site(client, admin, coach.id, [plans[0].id])
    content = draft(client, admin)
    for s in content["sections"]:
        if s["key"] == "trial":
            s["visible"] = False
    save(client, admin, content)
    publish(client, admin)
    assert submit(client).status_code == 404


def test_inquiries_are_isolated(client, beta_client, admin, beta_admin, gym, coach, plans, course):
    full_site(client, admin, coach.id, [plans[0].id])
    alpha_headers, beta_headers = auth(admin), auth(beta_admin)
    submit(client)
    inquiry_id = client.get(f"{API}/inquiries", headers=alpha_headers).json()[0]["id"]
    assert beta_client.get(f"{API}/inquiries", headers=beta_headers).json() == []
    res = beta_client.patch(f"{API}/inquiries/{inquiry_id}", json={"status": "未成交"}, headers=beta_headers)
    assert res.status_code == 404
    # beta 沒有發布網站，也收不到 alpha 的表單
    assert beta_client.post("/site/inquiry", data=FORM, follow_redirects=False).status_code == 404


def test_convert_to_member(client, admin, gym, coach, plans, course):
    full_site(client, admin, coach.id, [plans[0].id])
    submit(client)
    inquiry_id = client.get(f"{API}/inquiries", headers=auth(admin)).json()[0]["id"]
    url = f"{API}/inquiries/{inquiry_id}/convert"
    assert client.post(url, json={"username": "alex", "password": "member-pw-1"}, headers=auth(admin)).status_code == 400
    res = client.post(url, json={"username": "0912345678", "password": "member-pw-1"}, headers=auth(admin))
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "已成為會員" and res.json()["member_user_id"]
    assert res.json()["notes"][-1]["text"] == "已建立會員帳號「0912345678」"
    login = client.post(f"{API}/auth/login", data={"username": "0912345678", "password": "member-pw-1"})
    assert login.status_code == 200
    assert login.json()["role"] == "member" and login.json()["must_change_password"] is True
    again = client.post(url, json={"username": "other", "password": "member-pw-1"}, headers=auth(admin))
    assert again.status_code == 409


def test_retention_purges_old_non_members(client, admin, gym, db):
    old = datetime.utcnow() - timedelta(days=200)
    for name, status in (("舊詢問", InquiryStatus.new), ("舊未成交", InquiryStatus.lost),
                         ("舊會員", InquiryStatus.converted), ("新詢問", InquiryStatus.new)):
        db.add(Inquiry(name=name, phone="0912345678", status=status, consent_at=old,
                       created_at=old if name.startswith("舊") else datetime.utcnow()))
    db.commit()
    names = {r["name"] for r in client.get(f"{API}/inquiries", headers=auth(admin)).json()}
    assert names == {"舊會員", "新詢問"}

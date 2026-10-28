"""
會員名單與 LINE 受眾（ADR 0006、R31–R33）：上課紀錄篩選、行銷同意、上傳受眾只含可發送的會員，以及權限與租戶隔離。
"""

from datetime import date, datetime

import pytest

from app.core import clock
from app.models.coach import Coach
from app.models.course import Course, CourseStatus
from app.models.purchase import PaymentMethod, PaymentStatus, Purchase
from app.models.reservation import Attendance, Reservation, ReservationSource, ReservationStatus
from app.models.user import User, UserRole
from app.core.security import hash_password
from app.services.line import LineApiError
from tests.conftest import auth
from tests.test_line_oa import enabled, fake_oa, line_user  # noqa: F401  （共用 fixture）

API = "/api/v1"
TODAY = datetime(2030, 3, 1, 10, 0)
PERIOD = {"start": "2030-01-01", "end": "2030-02-28"}


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    monkeypatch.setattr(clock, "now_local", lambda: TODAY)


def make_member(db, username, *, name=None, line=None, consent=False, blacklisted=False, role=UserRole.member):
    u = User(username=username, password_hash=hash_password("pw"), role=role, display_name=name, phone="0912345678",
             line_user_id=line, is_blacklisted=blacklisted,
             marketing_consent_at=datetime(2030, 1, 1) if consent else None)
    db.add(u)
    db.commit()
    return u


def attend(db, user, product, day, *, course=None, coach=None, attendance=Attendance.attended,
           status=ReservationStatus.confirmed):
    db.add(Reservation(member_id=user.id, product_id=product.id, course_id=course.id if course else None,
                       coach_id=coach.id if coach else None, booking_date=date.fromisoformat(day), start_hour=19,
                       status=status, source=ReservationSource.member_submitted, attendance=attendance))
    db.commit()


@pytest.fixture()
def gym(db, pack):
    """王教練帶私人課、李教練帶團體課；六位會員上課狀況各不相同。"""
    wang_user = make_member(db, "wang")
    lee_user = make_member(db, "lee")
    wang = Coach(user_id=wang_user.id, name="王教練", phone="0900")
    lee = Coach(user_id=lee_user.id, name="李教練", phone="0911", is_group_coach=True)
    db.add_all([wang, lee])
    db.commit()
    course = Course(name="壺鈴循環", coach_id=lee.id, max_capacity=8, status=CourseStatus.on)
    db.add(course)
    db.commit()

    amy = make_member(db, "amy", name="Amy", line="U-amy", consent=True)  # 可發送；私人課 3 次
    ben = make_member(db, "ben", name="Ben", line="U-ben")  # 綁 LINE 但沒同意行銷；團體課 1 次
    cat = make_member(db, "cat", name="Cat")  # 沒綁 LINE；團體課 2 次，最後一次很久以前
    dan = make_member(db, "dan", line="U-dan", consent=True)  # 只有未到、待確認 → 不算
    eve = make_member(db, "eve", line="U-eve", consent=True, blacklisted=True)  # 黑名單 → 排除
    boss = make_member(db, "boss", line="U-boss", consent=True, role=UserRole.admin)  # 管理員 → 排除
    for day in ("2030-01-05", "2030-02-10", "2030-02-25"):
        attend(db, amy, pack, day, coach=wang)
    attend(db, amy, pack, "2029-12-20", coach=wang)  # 期間外
    attend(db, ben, pack, "2030-02-20", course=course)
    attend(db, cat, pack, "2030-01-03", course=course)
    attend(db, cat, pack, "2030-01-10", course=course)
    attend(db, dan, pack, "2030-02-01", coach=wang, attendance=Attendance.no_show)
    attend(db, dan, pack, "2030-02-02", coach=wang, attendance=None, status=ReservationStatus.pending)
    attend(db, eve, pack, "2030-02-01", coach=wang)
    attend(db, boss, pack, "2030-02-01", coach=wang)
    # Amy 還有 7 堂、Ben 剩 1 堂；未付款的不算
    db.add_all([
        Purchase(user_id=amy.id, product_id=pack.id, quantity=1, amount=10000, purchase_date=date(2030, 1, 1), created_by=amy.id,
                 total_hours=10, remaining_hours=7, payment_status=PaymentStatus.paid, payment_method=PaymentMethod.cash),
        Purchase(user_id=ben.id, product_id=pack.id, quantity=1, amount=10000, purchase_date=date(2030, 1, 1), created_by=amy.id,
                 total_hours=10, remaining_hours=1, payment_status=PaymentStatus.paid, payment_method=PaymentMethod.cash),
        Purchase(user_id=cat.id, product_id=pack.id, quantity=1, amount=10000, purchase_date=date(2030, 2, 1), created_by=amy.id,
                 total_hours=10, remaining_hours=0, payment_status=PaymentStatus.unpaid),
    ])
    db.commit()
    return {"wang": wang, "lee": lee, "course": course, "amy": amy, "ben": ben, "cat": cat}


def preview(client, admin, **filters):
    res = client.post(f"{API}/member-segments/preview", json={**PERIOD, **filters}, headers=auth(admin))
    assert res.status_code == 200, res.text
    return res.json()


def names(result):
    return [m["username"] for m in result["members"]]


def test_preview_counts_attended_members_only(client, admin, gym):
    r = preview(client, admin)
    # 只算已確認＋已出席；排除黑名單與管理員；依最後上課日由近到遠
    assert names(r) == ["amy", "ben", "cat"]
    assert (r["total"], r["sendable"], r["no_line"], r["no_consent"]) == (3, 1, 1, 1)
    amy = r["members"][0]
    assert amy["attended_count"] == 3 and amy["last_attended"] == "2030-02-25"
    assert amy["remaining_hours"] == 7 and amy["reach"] == "可發送" and amy["name"] == "Amy"
    assert {m["username"]: m["reach"] for m in r["members"]} == {"amy": "可發送", "ben": "未同意優惠訊息", "cat": "未綁定 LINE"}
    assert r["members"][2]["remaining_hours"] == 0  # 未付款的方案不算


def test_preview_filters(client, admin, gym):
    assert names(preview(client, admin, kind="團體課")) == ["ben", "cat"]
    assert names(preview(client, admin, kind="私人課")) == ["amy"]
    assert names(preview(client, admin, coach_id=gym["lee"].id)) == ["ben", "cat"]
    assert names(preview(client, admin, coach_id=gym["wang"].id)) == ["amy"]
    assert names(preview(client, admin, min_attended=2)) == ["amy", "cat"]
    assert names(preview(client, admin, max_remaining_hours=1)) == ["ben", "cat"]  # 續約對象
    assert names(preview(client, admin, inactive_days=30)) == ["cat"]  # 超過 30 天沒來
    assert names(preview(client, admin, start="2030-02-11", end="2030-02-28")) == ["amy", "ben"]
    res = client.post(f"{API}/member-segments/preview", json={"start": "2030-02-01", "end": "2030-01-01"},
                      headers=auth(admin))
    assert res.status_code == 422


def test_marketing_consent_by_member(client, db, member):
    headers = auth(member)
    me = client.get(f"{API}/auth/me", headers=headers).json()
    assert me["marketing_consent"] is False  # 預設不同意
    res = client.patch(f"{API}/auth/line/preferences", json={"marketing_consent": True}, headers=headers)
    assert res.status_code == 200
    assert res.json()["marketing_consent"] is True and res.json()["marketing_consent_at"]
    assert res.json()["line_notify"] is True  # 服務通知不受影響
    res = client.patch(f"{API}/auth/line/preferences", json={"line_notify": False}, headers=headers)
    assert res.json()["marketing_consent"] is True and res.json()["line_notify"] is False
    res = client.patch(f"{API}/auth/line/preferences", json={"marketing_consent": False}, headers=headers)
    assert res.json()["marketing_consent"] is False and res.json()["marketing_consent_at"] is None


def test_join_with_marketing_consent(client, db, enabled):  # noqa: F811
    for token, sub, consent in (("idtoken-marketing-yes", "U-a", True), ("idtoken-marketing-no", "U-b", False)):
        line_user(enabled, token, sub)
        link = client.post(f"{API}/auth/line", json={"id_token": token}).json()["link_token"]
        res = client.post(f"{API}/auth/line/join", json={"link_token": link, "display_name": "小明", "phone": "0912345678",
                                                         "consent": True, "marketing_consent": consent})
        assert res.status_code == 201
        assert db.query(User).filter(User.line_user_id == sub).one().marketing_consent is consent


def test_create_audience_uploads_sendable_only(client, admin, gym, enabled):  # noqa: F811
    res = client.post(f"{API}/member-segments/audiences", json={"name": "  三月續約  ", "filters": PERIOD},
                      headers=auth(admin))
    assert res.status_code == 201, res.text
    body = res.json()
    assert enabled.audiences == [("三月續約", ["U-amy"])]  # 沒同意、沒綁定、黑名單、管理員都不會上傳
    assert body["audience_group_id"] == 9001 and body["member_count"] == 1 and body["created_by_name"] == "admin"
    assert body["filters"]["start"] == "2030-01-01" and body["filters"]["kind"] == "全部"
    listed = client.get(f"{API}/member-segments/audiences", headers=auth(admin)).json()
    assert [a["name"] for a in listed] == ["三月續約"]

    # 沒有可發送的會員
    res = client.post(f"{API}/member-segments/audiences", json={"name": "團課", "filters": {**PERIOD, "kind": "團體課"}},
                      headers=auth(admin))
    assert res.status_code == 400
    # LINE 錯誤
    enabled.audience_error = LineApiError(400, "The request body has 1 error(s)")
    res = client.post(f"{API}/member-segments/audiences", json={"name": "再一次", "filters": PERIOD},
                      headers=auth(admin))
    assert res.status_code == 502 and "LINE" in res.json()["detail"]
    assert len(client.get(f"{API}/member-segments/audiences", headers=auth(admin)).json()) == 1


def test_audience_requires_enabled_channel(client, admin, gym, fake_oa):  # noqa: F811
    res = client.post(f"{API}/member-segments/audiences", json={"name": "x", "filters": PERIOD}, headers=auth(admin))
    assert res.status_code == 400 and "LINE 官方帳號" in res.json()["detail"]
    assert fake_oa.audiences == []


def test_admin_only_and_tenant_isolation(client, beta_client, admin, beta_admin, member, gym, enabled):  # noqa: F811
    assert client.post(f"{API}/member-segments/preview", json=PERIOD, headers=auth(member)).status_code == 403
    assert client.get(f"{API}/member-segments/audiences", headers=auth(member)).status_code == 403
    client.post(f"{API}/member-segments/audiences", json={"name": "a", "filters": PERIOD}, headers=auth(admin))
    # beta 看不到 alpha 的會員與受眾
    beta = beta_client.post(f"{API}/member-segments/preview", json=PERIOD, headers=auth(beta_admin)).json()
    assert beta["total"] == 0
    assert beta_client.get(f"{API}/member-segments/audiences", headers=auth(beta_admin)).json() == []

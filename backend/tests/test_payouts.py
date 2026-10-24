"""教練鐘點結算：計費範圍、團課一堂算一次、月結快照鎖定、撥款與取消結算、權限。"""

from datetime import date, datetime

import pytest

from app.core import clock
from app.core.security import hash_password
from app.models.coach import Coach
from app.models.course import Course
from app.models.product import Product, ProductCategory
from app.models.reservation import Attendance, Reservation, ReservationSource, ReservationStatus
from app.models.user import User, UserRole
from tests.conftest import auth

API = "/api/v1"
MONTH = "2030-01"


@pytest.fixture(autouse=True)
def now(monkeypatch):
    """預設「現在」為 2030-02-01，一月已結束可結算。"""
    state = {"value": datetime(2030, 2, 1, 9, 0)}
    monkeypatch.setattr(clock, "now_local", lambda: state["value"])
    return lambda v: state.__setitem__("value", v)


def make_user(db, username):
    u = User(username=username, password_hash=hash_password("pw"), role=UserRole.member)
    db.add(u)
    db.commit()
    return u


@pytest.fixture()
def coach_user(db):
    return make_user(db, "coach")


@pytest.fixture()
def coach(db, coach_user):
    c = Coach(user_id=coach_user.id, name="王教練", phone="0900", bank_code="012", bank_account="1234567890", session_rate=800)
    db.add(c)
    db.commit()
    return c


@pytest.fixture()
def product(db):
    p = Product(name="私人課", category=ProductCategory.single_course, session_hours=10, price=10000)
    db.add(p)
    db.commit()
    return p


@pytest.fixture()
def course(db, coach):
    c = Course(name="瑜珈", coach_id=coach.id, max_capacity=10)
    db.add(c)
    db.commit()
    return c


def res(db, member, product, *, day=7, hour=10, coach=None, course=None,
        attendance=Attendance.attended, status=ReservationStatus.confirmed, late_cancel=False):
    r = Reservation(
        member_id=member.id, product_id=product.id, coach_id=coach.id if coach else None,
        course_id=course.id if course else None, booking_date=date(2030, 1, day) if isinstance(day, int) else day,
        start_hour=hour, status=status, source=ReservationSource.admin_created,
        attendance=attendance, late_cancel=late_cancel,
    )
    db.add(r)
    db.commit()
    return r


def summary(client, admin, month=MONTH):
    res_ = client.get(f"{API}/coach-payouts/summary", params={"month": month}, headers=auth(admin))
    assert res_.status_code == 200, res_.text
    return {row["coach_id"]: row for row in res_.json()}


def settle(client, admin, coach, month=MONTH):
    return client.post(f"{API}/coach-payouts", json={"coach_id": coach.id, "month": month}, headers=auth(admin))


# ── 計費範圍 ──────────────────────────────────────────


def test_counts_attended_and_no_show_only(client, db, admin, member, coach, product):
    res(db, member, product, coach=coach, hour=10, attendance=Attendance.attended)
    res(db, member, product, coach=coach, hour=11, attendance=Attendance.no_show)
    res(db, member, product, coach=coach, hour=12, attendance=None)  # 未簽到
    res(db, member, product, coach=coach, hour=13, attendance=None,
        status=ReservationStatus.cancelled, late_cancel=True)  # 晚取消
    res(db, member, product, coach=coach, hour=14, attendance=None, status=ReservationStatus.pending)
    row = summary(client, admin)[coach.id]
    assert row["live_session_count"] == 2
    assert row["live_amount"] == 1600
    assert row["payout"] is None


def test_group_course_counts_once_per_session(client, db, admin, member, other_member, coach, product, course):
    res(db, member, product, course=course, hour=18)
    res(db, other_member, product, course=course, hour=18, attendance=Attendance.no_show)
    res(db, member, product, course=course, hour=18, day=14)
    assert summary(client, admin)[coach.id]["live_session_count"] == 2

    items = client.get(f"{API}/coach-payouts/live", params={"coach_id": coach.id, "month": MONTH},
                       headers=auth(admin)).json()
    assert [(i["kind"], i["attended_count"], i["no_show_count"]) for i in items] == [
        ("團體課", 1, 1), ("團體課", 1, 0)]
    assert items[0]["members"] == "member、other"


def test_group_course_goes_to_course_coach_not_reservation_coach(client, db, admin, member, coach, product, course):
    other = Coach(user_id=make_user(db, "c2").id, name="李教練", phone="0911", session_rate=500)
    db.add(other)
    db.commit()
    res(db, member, product, course=course, coach=other)
    rows = summary(client, admin)
    assert rows[coach.id]["live_session_count"] == 1
    assert rows[other.id]["live_session_count"] == 0


def test_coach_own_rental_not_counted(client, db, admin, coach, coach_user, product):
    res(db, coach_user, product, coach=coach)
    assert summary(client, admin)[coach.id]["live_session_count"] == 0


def test_month_boundaries(client, db, admin, member, coach, product):
    res(db, member, product, coach=coach, day=date(2029, 12, 31))
    res(db, member, product, coach=coach, day=1)
    res(db, member, product, coach=coach, day=31)
    res(db, member, product, coach=coach, day=date(2030, 2, 1))
    assert summary(client, admin)[coach.id]["live_session_count"] == 2


def test_invalid_month(client, admin):
    assert client.get(f"{API}/coach-payouts/summary", params={"month": "2030-13"}, headers=auth(admin)).status_code == 422


# ── 結算 ──────────────────────────────────────────────


def test_settle_snapshots_rate_and_items(client, db, admin, member, coach, product):
    res(db, member, product, coach=coach, hour=10)
    res(db, member, product, coach=coach, hour=11, attendance=Attendance.no_show)
    r = settle(client, admin, coach)
    assert r.status_code == 201, r.text
    body = r.json()
    assert (body["session_count"], body["rate"], body["amount"], body["status"]) == (2, 800, 1600, "已結算")
    assert body["period"] == "2030-01-01"
    assert len(body["items"]) == 2

    # 之後調整費率，不影響已結算金額
    coach.session_rate = 1000
    db.commit()
    row = summary(client, admin)[coach.id]
    assert row["payout"]["amount"] == 1600
    assert row["live_amount"] == 2000
    assert row["changed_since_settled"] is False  # 堂數明細沒變


def test_attendance_change_after_settlement_is_flagged(client, db, admin, member, coach, product):
    r = res(db, member, product, coach=coach)
    settle(client, admin, coach)
    r.attendance = Attendance.no_show
    db.commit()
    row = summary(client, admin)[coach.id]
    assert row["payout"]["session_count"] == 1
    assert row["changed_since_settled"] is True


def test_cannot_settle_current_month(client, db, admin, member, coach, product, now):
    res(db, member, product, coach=coach)
    now(datetime(2030, 1, 31, 23, 59))
    r = settle(client, admin, coach)
    assert r.status_code == 400
    assert r.json()["detail"] == "只能結算已結束的月份"


def test_cannot_settle_twice(client, db, admin, member, coach, product):
    res(db, member, product, coach=coach)
    settle(client, admin, coach)
    assert settle(client, admin, coach).status_code == 409


def test_cannot_settle_empty_month(client, admin, coach):
    r = settle(client, admin, coach)
    assert r.status_code == 400
    assert r.json()["detail"] == "本月沒有可結算的堂數"


def test_mark_paid_then_cannot_void(client, db, admin, member, coach, product):
    res(db, member, product, coach=coach)
    pid = settle(client, admin, coach).json()["id"]
    r = client.post(f"{API}/coach-payouts/{pid}/mark-paid", json={"payment_note": "2/5 匯款"}, headers=auth(admin))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "已撥款"
    assert r.json()["paid_by"] == admin.id
    assert client.post(f"{API}/coach-payouts/{pid}/mark-paid", json={}, headers=auth(admin)).status_code == 400
    r = client.delete(f"{API}/coach-payouts/{pid}", headers=auth(admin))
    assert r.status_code == 400
    assert r.json()["detail"] == "已撥款的結算不可取消"


def test_void_and_resettle(client, db, admin, member, coach, product):
    res(db, member, product, coach=coach)
    pid = settle(client, admin, coach).json()["id"]
    res(db, member, product, coach=coach, hour=15)  # 補登一堂
    assert client.delete(f"{API}/coach-payouts/{pid}", headers=auth(admin)).status_code == 204
    assert summary(client, admin)[coach.id]["payout"] is None
    assert settle(client, admin, coach).json()["session_count"] == 2


# ── 權限 ──────────────────────────────────────────────


def test_admin_only_endpoints(client, db, member, coach, coach_user, product):
    for user in (member, coach_user):
        assert client.get(f"{API}/coach-payouts/summary", params={"month": MONTH}, headers=auth(user)).status_code == 403
        assert settle(client, user, coach).status_code == 403


def test_coach_sees_only_own_payouts(client, db, admin, member, coach, coach_user, product):
    res(db, member, product, coach=coach)
    pid = settle(client, admin, coach).json()["id"]
    mine = client.get(f"{API}/coach-payouts/mine", headers=auth(coach_user)).json()
    assert [p["id"] for p in mine] == [pid]
    assert client.get(f"{API}/coach-payouts/{pid}", headers=auth(coach_user)).json()["items"][0]["title"] == "私人課"

    other_user = make_user(db, "c3")
    db.add(Coach(user_id=other_user.id, name="張教練", phone="0922"))
    db.commit()
    assert client.get(f"{API}/coach-payouts/{pid}", headers=auth(other_user)).status_code == 404
    assert client.get(f"{API}/coach-payouts/{pid}", headers=auth(member)).status_code == 404
    assert client.get(f"{API}/coach-payouts/mine", headers=auth(member)).status_code == 403


def test_members_cannot_see_coach_private_fields(client, admin, member, coach):
    row = client.get(f"{API}/coaches", headers=auth(member)).json()[0]
    assert row["name"] == "王教練"
    assert (row["phone"], row["bank_account"], row["bank_code"], row["session_rate"], row["line_name"]) == (
        None, None, None, None, None)
    admin_row = client.get(f"{API}/coaches", headers=auth(admin)).json()[0]
    assert (admin_row["bank_account"], admin_row["session_rate"]) == ("1234567890", 800)


def test_admin_sets_session_rate(client, admin, coach):
    r = client.put(f"{API}/coaches/{coach.id}", json={"session_rate": 950}, headers=auth(admin))
    assert r.status_code == 200, r.text
    assert r.json()["session_rate"] == 950
    assert client.put(f"{API}/coaches/{coach.id}", json={"session_rate": -1}, headers=auth(admin)).status_code == 422
    assert client.put(f"{API}/coaches/{coach.id}", json={"session_rate": None}, headers=auth(admin)).status_code == 422
    assert client.put(f"{API}/coaches/{coach.id}", json={"name": "王大教練"}, headers=auth(admin)).json()["session_rate"] == 950

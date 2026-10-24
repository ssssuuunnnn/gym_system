"""會員預約課程用的團體課表 GET /courses/schedule。"""

from datetime import date

import pytest

from app.core.security import hash_password
from app.models.coach import Coach
from app.models.course import Course, CourseSession, CourseStatus, SessionSource
from app.models.product import Product, ProductCategory
from app.models.reservation import Reservation, ReservationSource, ReservationStatus
from app.models.user import User, UserRole
from tests.conftest import auth

API = "/api/v1"


@pytest.fixture()
def coach(db):
    u = User(username="lily", password_hash=hash_password("pw"), role=UserRole.member)
    db.add(u)
    db.commit()
    c = Coach(user_id=u.id, name="Lily", alias="Lily 老師", phone="0900", is_group_coach=True)
    db.add(c)
    db.commit()
    return c


def make_course(db, coach, name="瑜珈", status=CourseStatus.on, archived=False, sessions=()):
    course = Course(name=name, coach_id=coach.id, max_capacity=8, status=status, is_archived=archived)
    for i, (d, minute, cancelled) in enumerate(sessions):
        course.sessions.append(
            CourseSession(position=i, session_date=d, start_minute=minute, duration_minutes=60,
                          source=SessionSource.scheduled, is_cancelled=cancelled)
        )
    db.add(course)
    db.commit()
    return course


def reserve(db, member, course, d, hour, status=ReservationStatus.confirmed, people=1):
    p = db.query(Product).first()
    if p is None:
        p = Product(name="團課", category=ProductCategory.single_course, session_hours=8, price=4000)
        db.add(p)
        db.commit()
    r = Reservation(member_id=member.id, product_id=p.id, course_id=course.id, booking_date=d, start_hour=hour,
                    people_count=people, status=status, source=ReservationSource.admin_created)
    db.add(r)
    db.commit()
    return r


def schedule(client, user, start="2030-01-01", end="2030-01-07"):
    return client.get(f"{API}/courses/schedule", params={"start": start, "end": end}, headers=auth(user))


def test_lists_bookable_sessions_only(client, db, member, coach):
    make_course(db, coach, "瑜珈", sessions=[(date(2030, 1, 2), 600, False), (date(2030, 1, 3), 600, True)])
    make_course(db, coach, "下架課", status=CourseStatus.off, sessions=[(date(2030, 1, 2), 660, False)])
    make_course(db, coach, "封存課", archived=True, sessions=[(date(2030, 1, 2), 720, False)])
    make_course(db, coach, "範圍外", sessions=[(date(2030, 1, 9), 600, False)])
    rows = schedule(client, member).json()
    assert [(r["course_name"], r["session_date"]) for r in rows] == [("瑜珈", "2030-01-02")]
    assert rows[0]["coach_name"] == "Lily 老師"
    assert rows[0]["max_capacity"] == 8


def test_booked_count_and_my_reservation(client, db, member, other_member, coach):
    course = make_course(db, coach, sessions=[(date(2030, 1, 2), 600, False), (date(2030, 1, 2), 1140, False)])
    mine = reserve(db, member, course, date(2030, 1, 2), 10, status=ReservationStatus.pending)
    reserve(db, other_member, course, date(2030, 1, 2), 10, people=2)
    reserve(db, other_member, course, date(2030, 1, 2), 10, status=ReservationStatus.cancelled)
    rows = schedule(client, member).json()
    ten = next(r for r in rows if r["start_minute"] == 600)
    assert ten["booked_count"] == 3  # 待確認 1 + 已確認 2，已取消不算
    assert ten["my_reservation_id"] == mine.id
    assert ten["my_reservation_status"] == "待確認"
    seven_pm = next(r for r in rows if r["start_minute"] == 1140)
    assert (seven_pm["booked_count"], seven_pm["my_reservation_id"]) == (0, None)
    # 別人看同一堂：看不到我的預約
    other_view = next(r for r in schedule(client, other_member).json() if r["start_minute"] == 600)
    assert other_view["my_reservation_status"] == "已確認"


def test_range_validation(client, member):
    assert schedule(client, member, "2030-01-07", "2030-01-01").status_code == 400
    assert schedule(client, member, "2030-01-01", "2030-02-15").status_code == 400
    assert schedule(client, member, "2030-01-01", "2030-01-31").status_code == 200


def test_requires_login(client):
    assert client.get(f"{API}/courses/schedule", params={"start": "2030-01-01", "end": "2030-01-02"}).status_code == 401

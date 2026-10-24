"""取消期限（晚取消不退堂）與簽到／出席狀態。"""

from datetime import datetime

import pytest

from app.core import clock
from app.models.coach import Coach
from app.models.course import Course
from app.models.system_settings import SystemSettings
from app.models.user import User, UserRole
from app.core.security import hash_password
from tests.conftest import auth
from tests.test_hour_ledger import API, assert_books_balance, buy, remaining

CLASS_DATE = "2030-01-07"
CLASS_HOUR = 10  # 2030-01-07 10:00 開課


def at(hour: int, minute: int = 0, day: int = 7):
    return datetime(2030, 1, day, hour, minute)


@pytest.fixture()
def now(monkeypatch):
    """可設定的「現在時間」（工作室當地時間）。"""
    state = {"value": datetime(2030, 1, 1, 9, 0)}
    monkeypatch.setattr(clock, "now_local", lambda: state["value"])

    def set_now(value):
        state["value"] = value

    return set_now


@pytest.fixture()
def coach_user(db):
    user = User(username="coach", password_hash=hash_password("pw"), role=UserRole.member)
    db.add(user)
    db.commit()
    coach = Coach(user_id=user.id, name="王教練", phone="0900")
    db.add(coach)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def coach(db, coach_user):
    return db.query(Coach).filter(Coach.user_id == coach_user.id).one()


def confirmed_booking(client, admin, member, pack, coach_id=None, course_id=None, hour=CLASS_HOUR):
    p = buy(client, admin, member, pack)
    res = client.post(
        f"{API}/reservations?as_admin=true",
        json={
            "member_id": member.id,
            "product_id": pack.id,
            "purchase_id": p["id"],
            "coach_id": coach_id,
            "course_id": course_id,
            "booking_date": CLASS_DATE,
            "start_hour": hour,
        },
        headers=auth(admin),
    )
    assert res.status_code == 201, res.text
    return p, res.json()


def cancel(client, user, rid, refund=None):
    body = None if refund is None else {"refund": refund}
    return client.post(f"{API}/reservations/{rid}/cancel", json=body, headers=auth(user))


def mark(client, user, rid, attendance):
    return client.post(f"{API}/reservations/{rid}/attendance", json={"attendance": attendance}, headers=auth(user))


def set_deadline(db, hours):
    row = db.query(SystemSettings).first() or SystemSettings(company_name="測試")
    row.cancel_deadline_hours = hours
    db.add(row)
    db.commit()


# ── 取消期限 ──────────────────────────────────────────


def test_default_deadline_is_12_hours(client, admin):
    assert client.get(f"{API}/system-settings", headers=auth(admin)).json()["cancel_deadline_hours"] == 12


def test_cancel_before_deadline_refunds(client, db, admin, member, pack, now):
    p, r = confirmed_booking(client, admin, member, pack)
    now(at(21, 59, day=6))  # 開課前 12 小時又 1 分
    res = cancel(client, member, r["id"])
    assert res.status_code == 200, res.text
    assert res.json()["late_cancel"] is False
    assert remaining(client, member, p["id"]) == 10
    assert_books_balance(db)


def test_late_cancel_keeps_hours_deducted(client, db, admin, member, pack, now):
    p, r = confirmed_booking(client, admin, member, pack)
    now(at(22, 0, day=6))  # 剛好開課前 12 小時
    res = cancel(client, member, r["id"])
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "已取消"
    assert res.json()["late_cancel"] is True
    assert remaining(client, member, p["id"]) == 9
    reasons = [e["reason"] for e in client.get(f"{API}/purchases/{p['id']}/ledger", headers=auth(member)).json()]
    assert reasons == ["購買", "預約扣抵"]
    assert_books_balance(db)


def test_pending_reservation_always_refunds(client, db, admin, member, pack, now):
    """待確認代表工作室尚未接受，期限內取消仍退堂。"""
    p = buy(client, admin, member, pack)
    r = client.post(
        f"{API}/reservations",
        json={"member_id": member.id, "product_id": pack.id, "purchase_id": p["id"],
              "booking_date": CLASS_DATE, "start_hour": CLASS_HOUR},
        headers=auth(member),
    ).json()
    now(at(9, 0))
    res = cancel(client, member, r["id"])
    assert res.json()["late_cancel"] is False
    assert remaining(client, member, p["id"]) == 10


def test_deadline_zero_means_no_limit(client, db, admin, member, pack, now):
    set_deadline(db, 0)
    p, r = confirmed_booking(client, admin, member, pack)
    now(at(9, 59))
    assert cancel(client, member, r["id"]).json()["late_cancel"] is False
    assert remaining(client, member, p["id"]) == 10


def test_deadline_setting_is_used(client, db, admin, member, pack, now):
    set_deadline(db, 2)
    p, r = confirmed_booking(client, admin, member, pack)
    now(at(7, 59))  # 開課前 2 小時又 1 分 → 不算晚取消
    assert cancel(client, member, r["id"]).json()["late_cancel"] is False


def test_admin_can_override_refund_on_late_cancel(client, db, admin, member, pack, now):
    p, r = confirmed_booking(client, admin, member, pack)
    now(at(9, 0))
    res = cancel(client, admin, r["id"], refund=True)
    assert res.json()["late_cancel"] is True
    assert remaining(client, member, p["id"]) == 10
    assert_books_balance(db)


def test_member_cannot_override_refund(client, db, admin, member, pack, now):
    p, r = confirmed_booking(client, admin, member, pack)
    now(at(9, 0))
    cancel(client, member, r["id"], refund=True)
    assert remaining(client, member, p["id"]) == 9


def test_member_cannot_cancel_after_class_started(client, admin, member, pack, now):
    _, r = confirmed_booking(client, admin, member, pack)
    now(at(10, 1))
    res = cancel(client, member, r["id"])
    assert res.status_code == 400
    assert res.json()["detail"] == "課程已開始，無法取消"


def test_admin_can_update_deadline(client, admin, member):
    url = f"{API}/system-settings"
    assert client.put(url, json={"cancel_deadline_hours": 24}, headers=auth(admin)).json()["cancel_deadline_hours"] == 24
    assert client.put(url, json={"cancel_deadline_hours": -1}, headers=auth(admin)).status_code == 422
    assert client.put(url, json={"cancel_deadline_hours": 6}, headers=auth(member)).status_code == 403


# ── 簽到：學員本人 ────────────────────────────────────


def test_member_self_check_in_within_window(client, db, admin, member, pack, now):
    p, r = confirmed_booking(client, admin, member, pack)
    now(at(9, 30))
    res = mark(client, member, r["id"], "已出席")
    assert res.status_code == 200, res.text
    assert res.json()["attendance"] == "已出席"
    assert res.json()["checked_in_by"] == member.id
    assert remaining(client, member, p["id"]) == 9  # 出席照扣


@pytest.mark.parametrize("when", [at(9, 29), at(11, 1)])
def test_member_self_check_in_outside_window(client, admin, member, pack, now, when):
    _, r = confirmed_booking(client, admin, member, pack)
    now(when)
    res = mark(client, member, r["id"], "已出席")
    assert res.status_code == 400
    assert res.json()["detail"] == "只能在開課前 30 分鐘到下課之間簽到"


def test_member_cannot_mark_no_show_or_change(client, admin, member, pack, now):
    _, r = confirmed_booking(client, admin, member, pack)
    now(at(10, 0))
    assert mark(client, member, r["id"], "未到").status_code == 403
    mark(client, member, r["id"], "已出席")
    assert mark(client, member, r["id"], "已出席").status_code == 400


def test_member_cannot_check_in_for_others(client, admin, member, other_member, pack, now):
    _, r = confirmed_booking(client, admin, member, pack)
    now(at(10, 0))
    assert mark(client, other_member, r["id"], "已出席").status_code == 403


def test_pending_reservation_cannot_check_in(client, admin, member, pack, now):
    r = client.post(
        f"{API}/reservations",
        json={"member_id": member.id, "product_id": pack.id, "booking_date": CLASS_DATE, "start_hour": CLASS_HOUR},
        headers=auth(member),
    ).json()
    now(at(10, 0))
    assert mark(client, admin, r["id"], "已出席").status_code == 400


def test_course_duration_extends_self_check_in_window(client, db, admin, member, pack, coach, now):
    course = Course(name="TRX", coach_id=coach.id, max_capacity=10, duration_minutes=90)
    db.add(course)
    db.commit()
    _, r = confirmed_booking(client, admin, member, pack, course_id=course.id)
    now(at(11, 20))  # 90 分鐘課，11:30 下課
    assert mark(client, member, r["id"], "已出席").status_code == 200


# ── 簽到：教練與管理員 ────────────────────────────────


def test_coach_marks_no_show_and_hours_stay_deducted(client, db, admin, member, pack, coach, coach_user, now):
    p, r = confirmed_booking(client, admin, member, pack, coach_id=coach.id)
    now(at(10, 5))
    res = mark(client, coach_user, r["id"], "未到")
    assert res.status_code == 200, res.text
    assert res.json()["attendance"] == "未到"
    assert remaining(client, member, p["id"]) == 9
    assert_books_balance(db)


def test_coach_of_group_course_can_check_in(client, db, admin, member, pack, coach, coach_user, now):
    course = Course(name="瑜珈", coach_id=coach.id, max_capacity=10)
    db.add(course)
    db.commit()
    _, r = confirmed_booking(client, admin, member, pack, course_id=course.id)
    now(at(9, 45))
    assert mark(client, coach_user, r["id"], "已出席").status_code == 200


def test_other_coach_cannot_check_in(client, db, admin, member, pack, coach_user, now):
    other_user = User(username="coach2", password_hash=hash_password("pw"), role=UserRole.member)
    db.add(other_user)
    db.commit()
    other = Coach(user_id=other_user.id, name="李教練", phone="0911")
    db.add(other)
    db.commit()
    _, r = confirmed_booking(client, admin, member, pack, coach_id=other.id)
    now(at(10, 0))
    assert mark(client, coach_user, r["id"], "已出席").status_code == 403


def test_no_show_only_after_class_started(client, admin, member, pack, now):
    _, r = confirmed_booking(client, admin, member, pack)
    now(at(9, 50))
    res = mark(client, admin, r["id"], "未到")
    assert res.status_code == 400
    assert res.json()["detail"] == "課程開始後才能標記未到"


def test_staff_cannot_check_in_too_early(client, admin, member, pack, now):
    _, r = confirmed_booking(client, admin, member, pack)
    now(at(9, 0))
    assert mark(client, admin, r["id"], "已出席").status_code == 400


def test_staff_can_correct_later(client, admin, member, pack, now):
    _, r = confirmed_booking(client, admin, member, pack)
    now(at(10, 10))
    mark(client, member, r["id"], "已出席")
    now(datetime(2030, 1, 9, 12, 0))  # 兩天後補登更正
    res = mark(client, admin, r["id"], "未到")
    assert res.status_code == 200
    assert res.json()["attendance"] == "未到"


def test_checked_in_reservation_cannot_be_cancelled(client, admin, member, pack, now):
    _, r = confirmed_booking(client, admin, member, pack)
    now(at(10, 0))
    mark(client, member, r["id"], "已出席")
    res = cancel(client, admin, r["id"])
    assert res.status_code == 400
    assert res.json()["detail"] == "已標記出席狀態的預約無法取消"


def test_coaching_list(client, db, admin, member, pack, coach, coach_user):
    course = Course(name="瑜珈", coach_id=coach.id, max_capacity=10)
    db.add(course)
    db.commit()
    _, by_coach = confirmed_booking(client, admin, member, pack, coach_id=coach.id, hour=10)
    _, by_course = confirmed_booking(client, admin, member, pack, course_id=course.id, hour=11)
    _, unrelated = confirmed_booking(client, admin, member, pack, hour=12)
    rows = client.get(f"{API}/reservations/coaching", headers=auth(coach_user)).json()
    assert [r["id"] for r in rows] == [by_coach["id"], by_course["id"]]
    assert rows[0]["member_username"] == "member"
    assert client.get(f"{API}/reservations/coaching", headers=auth(member)).status_code == 403

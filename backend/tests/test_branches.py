"""
分店（ADR 0007、R34–R36）：分店管理、公休各店獨立、預約的分店與教練／方案限制、課程與教練的分店、
課表與名單篩選、權限與租戶隔離。
"""

from datetime import date

import pytest

from app.core.security import hash_password
from app.models.coach import Coach
from app.models.course import Course, CourseSession, CourseStatus, SessionSource
from app.models.reservation import Reservation
from app.models.user import User, UserRole
from tests.conftest import auth

API = "/api/v1"
DAY = "2030-01-02"


@pytest.fixture()
def branches(client, admin):
    """總店（自動建立）＋信義店。"""
    main = client.get(f"{API}/branches", headers=auth(admin)).json()[0]
    res = client.post(f"{API}/branches", json={"name": "信義店", "address": "台北市信義區", "sort_order": 1},
                      headers=auth(admin))
    assert res.status_code == 201, res.text
    return main["id"], res.json()["id"]


def make_coach(db, username, branch_ids, *, group=False):
    u = User(username=username, password_hash=hash_password("pw"), role=UserRole.member)
    db.add(u)
    db.commit()
    c = Coach(user_id=u.id, name=username, phone="0900", is_group_coach=group)
    c.branch_ids = branch_ids
    db.add(c)
    db.commit()
    return c


def book(client, user, product, *, as_admin=False, **extra):
    body = {"member_id": user.id, "product_id": product.id, "booking_date": DAY, "start_hour": 10, **extra}
    params = {"as_admin": "true"} if as_admin else {}
    return client.post(f"{API}/reservations", json=body, params=params, headers=auth(user))


# ---------- 分店管理 ----------


def test_default_branch_and_management(client, admin, member):
    listed = client.get(f"{API}/branches", headers=auth(admin)).json()
    assert [b["name"] for b in listed] == ["總店"]  # 沒有分店時自動建立
    h = auth(admin)
    a = client.post(f"{API}/branches", json={"name": " 信義店 ", "phone": " 02-1234 ", "sort_order": 2}, headers=h).json()
    assert a["name"] == "信義店" and a["phone"] == "02-1234" and a["address"] is None
    assert client.post(f"{API}/branches", json={"name": "信義店"}, headers=h).status_code == 409
    client.post(f"{API}/branches", json={"name": "板橋店", "sort_order": 1}, headers=h)
    assert [b["name"] for b in client.get(f"{API}/branches", headers=h).json()] == ["總店", "板橋店", "信義店"]

    res = client.put(f"{API}/branches/{a['id']}", json={"is_active": False, "address": "台北市"}, headers=h)
    assert res.status_code == 200 and res.json()["is_active"] is False and res.json()["address"] == "台北市"
    # 會員只看到啟用中的分店；不能新增
    assert [b["name"] for b in client.get(f"{API}/branches", headers=auth(member)).json()] == ["總店", "板橋店"]
    assert client.post(f"{API}/branches", json={"name": "x"}, headers=auth(member)).status_code == 403


def test_cannot_deactivate_last_or_with_live_courses(client, db, admin, branches):
    main, xinyi = branches
    h = auth(admin)
    coach = make_coach(db, "lee", [xinyi], group=True)
    db.add(Course(name="壺鈴", coach_id=coach.id, branch_id=xinyi, max_capacity=8, status=CourseStatus.on))
    db.commit()
    res = client.put(f"{API}/branches/{xinyi}", json={"is_active": False}, headers=h)
    assert res.status_code == 400 and "上架" in res.json()["detail"]
    assert client.put(f"{API}/branches/{main}", json={"is_active": False}, headers=h).status_code == 200
    db.query(Course).update({Course.status: CourseStatus.off})
    db.commit()
    res = client.put(f"{API}/branches/{xinyi}", json={"is_active": False}, headers=h)
    assert res.status_code == 400 and "至少" in res.json()["detail"]


# ---------- 公休與預約 ----------


def test_closed_slots_are_per_branch(client, admin, member, pack, branches):
    main, xinyi = branches
    h = auth(admin)
    res = client.put(f"{API}/time-slots", json={"slot_date": DAY, "start_hour": 10, "is_open": False, "branch_id": xinyi},
                     headers=h)
    assert res.status_code == 200 and res.json()["branch_id"] == xinyi
    slots = client.get(f"{API}/time-slots", params={"branch_id": main}, headers=h).json()
    assert slots == []
    assert len(client.get(f"{API}/time-slots", headers=h).json()) == 1

    closed = book(client, member, pack, branch_id=xinyi)
    assert closed.status_code == 400 and "關閉" in closed.json()["detail"]
    ok = book(client, member, pack, branch_id=main)
    assert ok.status_code == 201 and ok.json()["branch_id"] == main
    # 省略分店＝預設分店（總店）
    assert book(client, member, pack).json()["branch_id"] == main


def test_private_booking_checks_coach_and_plan_branch(client, db, admin, member, pack, branches):
    main, xinyi = branches
    wang = make_coach(db, "wang", [main])
    res = book(client, member, pack, branch_id=xinyi, coach_id=wang.id)
    assert res.status_code == 400 and "不在「信義店」授課" in res.json()["detail"]
    assert book(client, member, pack, branch_id=main, coach_id=wang.id).status_code == 201

    # 方案限定信義店
    res = client.put(f"{API}/products/{pack.id}", json={"branch_ids": [xinyi]}, headers=auth(admin))
    assert res.status_code == 200 and res.json()["branch_ids"] == [xinyi]
    res = book(client, member, pack, branch_id=main)
    assert res.status_code == 400 and "不能在「總店」使用" in res.json()["detail"]
    assert book(client, member, pack, branch_id=xinyi).status_code == 201

    # 停用的分店不能預約
    client.put(f"{API}/products/{pack.id}", json={"branch_ids": []}, headers=auth(admin))
    client.put(f"{API}/branches/{xinyi}", json={"is_active": False}, headers=auth(admin))
    res = book(client, member, pack, branch_id=xinyi)
    assert res.status_code == 400 and "停用" in res.json()["detail"]


def test_group_booking_follows_course_branch(client, db, admin, member, pack, branches):
    main, xinyi = branches
    lee = make_coach(db, "lee", [xinyi], group=True)
    course = Course(name="壺鈴", coach_id=lee.id, branch_id=xinyi, max_capacity=8, status=CourseStatus.on)
    course.sessions.append(CourseSession(position=0, session_date=date(2030, 1, 2), start_minute=600,
                                         duration_minutes=60, source=SessionSource.scheduled))
    db.add(course)
    db.commit()
    res = book(client, member, pack, branch_id=main, course_id=course.id)  # 傳錯分店也以課程為準
    assert res.status_code == 201 and res.json()["branch_id"] == xinyi

    # 課表：分店名稱與篩選
    params = {"start": "2030-01-01", "end": "2030-01-07"}
    rows = client.get(f"{API}/courses/schedule", params=params, headers=auth(member)).json()
    assert rows[0]["branch_id"] == xinyi and rows[0]["branch_name"] == "信義店"
    assert client.get(f"{API}/courses/schedule", params={**params, "branch_id": main}, headers=auth(member)).json() == []
    assert len(client.get(f"{API}/courses", params={"branch_id": xinyi}, headers=auth(admin)).json()) == 1
    # 預約列表依分店篩選
    assert len(client.get(f"{API}/reservations", params={"branch_id": xinyi}, headers=auth(admin)).json()) == 1
    assert client.get(f"{API}/reservations", params={"branch_id": main}, headers=auth(admin)).json() == []

    # 已有預約的課程不能換分店
    res = client.put(f"{API}/courses/{course.id}", json={"branch_id": main}, headers=auth(admin))
    assert res.status_code == 400 and "更換分店" in res.json()["detail"]


# ---------- 課程、教練、方案的分店設定 ----------


def test_course_coach_must_teach_at_branch(client, db, admin, branches):
    main, xinyi = branches
    lee = make_coach(db, "lee", [xinyi], group=True)
    body = {"name": "壺鈴", "coach_id": lee.id, "max_capacity": 8, "status": "草稿"}
    res = client.post(f"{API}/courses", json={**body, "branch_id": main}, headers=auth(admin))
    assert res.status_code == 400 and "不在「總店」授課" in res.json()["detail"]
    res = client.post(f"{API}/courses", json={**body, "branch_id": xinyi}, headers=auth(admin))
    assert res.status_code == 201 and res.json()["branch_id"] == xinyi
    course_id = res.json()["id"]
    res = client.put(f"{API}/courses/{course_id}", json={"branch_id": main}, headers=auth(admin))
    assert res.status_code == 400  # 教練不在總店
    client.put(f"{API}/coaches/{lee.id}", json={"branch_ids": [main, xinyi]}, headers=auth(admin))
    res = client.put(f"{API}/courses/{course_id}", json={"branch_id": main}, headers=auth(admin))
    assert res.status_code == 200 and res.json()["branch_id"] == main


def test_coach_branches(client, db, admin, member, branches):
    main, xinyi = branches
    h = auth(admin)
    res = client.post(f"{API}/coaches", json={"user_id": member.id, "name": "小美", "phone": "0900"}, headers=h)
    assert res.status_code == 201 and res.json()["branch_ids"] == [main]  # 省略＝預設分店
    coach_id = res.json()["id"]
    assert client.put(f"{API}/coaches/{coach_id}", json={"branch_ids": []}, headers=h).status_code == 422
    assert client.put(f"{API}/coaches/{coach_id}", json={"branch_ids": [999999]}, headers=h).status_code == 400
    res = client.put(f"{API}/coaches/{coach_id}", json={"branch_ids": [xinyi, main], "coach_types": ["團體課程教練"]},
                     headers=h)
    assert sorted(res.json()["branch_ids"]) == sorted([main, xinyi])
    assert client.get(f"{API}/coaches", headers=auth(member)).json()[0]["branch_ids"]  # 會員也看得到授課分店

    # 在信義店還有上架課程時，不能把信義店拿掉
    db.add(Course(name="壺鈴", coach_id=coach_id, branch_id=xinyi, max_capacity=8, status=CourseStatus.on))
    db.commit()
    res = client.put(f"{API}/coaches/{coach_id}", json={"branch_ids": [main]}, headers=h)
    assert res.status_code == 400 and "壺鈴" in res.json()["detail"]


def test_product_branch_scope_only_for_single_course(client, admin, branches):
    main, xinyi = branches
    h = auth(admin)
    res = client.post(f"{API}/products", json={"name": "私人課 10 堂", "category": "課程", "session_hours": 10,
                                               "price": 10000, "branch_ids": [xinyi]}, headers=h)
    assert res.status_code == 201 and res.json()["branch_ids"] == [xinyi]
    res = client.post(f"{API}/products", json={"name": "毛巾", "category": "用品", "stock": 3, "price": 300,
                                               "branch_ids": [xinyi]}, headers=h)
    assert res.json()["branch_ids"] == []  # 用品不限分店
    assert client.post(f"{API}/products", json={"name": "x", "category": "課程", "session_hours": 1, "price": 1,
                                                "branch_ids": [999999]}, headers=h).status_code == 400


# ---------- 名單、隔離 ----------


def test_segment_branch_filter(client, db, admin, member, pack, branches):
    from app.models.reservation import Attendance, ReservationStatus

    main, xinyi = branches
    for branch_id in (main, xinyi):
        res = book(client, admin, pack, as_admin=True, member_id=member.id, branch_id=branch_id)
        r = db.get(Reservation, res.json()["id"])
        r.attendance = Attendance.attended
    db.commit()
    assert db.query(Reservation).filter(Reservation.status == ReservationStatus.confirmed).count() == 2
    period = {"start": "2030-01-01", "end": "2030-01-31"}
    res = client.post(f"{API}/member-segments/preview", json={**period, "branch_id": xinyi}, headers=auth(admin)).json()
    assert res["total"] == 1 and res["members"][0]["attended_count"] == 1
    res = client.post(f"{API}/member-segments/preview", json=period, headers=auth(admin)).json()
    assert res["members"][0]["attended_count"] == 2


def test_tenant_isolation(client, beta_client, admin, beta_admin, branches):
    main, xinyi = branches
    beta = beta_client.get(f"{API}/branches", headers=auth(beta_admin)).json()
    assert [b["name"] for b in beta] == ["總店"] and beta[0]["id"] not in (main, xinyi)
    assert beta_client.put(f"{API}/branches/{xinyi}", json={"name": "x"}, headers=auth(beta_admin)).status_code == 404
    res = beta_client.put(f"{API}/time-slots", json={"slot_date": DAY, "start_hour": 10, "is_open": False,
                                                    "branch_id": xinyi}, headers=auth(beta_admin))
    assert res.status_code == 400  # 別家的分店等於不存在

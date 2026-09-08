import os
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.db.session import get_db
from app.deps import get_current_user, require_admin
from app.models.course import (
    Course,
    CourseSession,
    CourseStatus,
    CourseWeekday,
    ScheduleEndMode,
)
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User
from app.schemas.course import (
    CoachCourseSessionOut,
    CourseCoverOut,
    CourseCreate,
    CourseDetailOut,
    CourseOut,
    CourseStatusUpdate,
    CourseUpdate,
)

router = APIRouter(prefix="/courses", tags=["courses"])

# 計入「已報名人數」的預約狀態（待確認 + 已確認）
_ENROLLED_STATUSES = [ReservationStatus.pending, ReservationStatus.confirmed]

# 課程封面：僅接受 jpg、png，單檔 2MB 以內（與教練照片一致）
COVER_CONTENT_TYPES = {"image/jpeg": ".jpg", "image/png": ".png"}
COVER_MAX_BYTES = 2 * 1024 * 1024


def _enrolled_counts(db: Session) -> dict[int, int]:
    """每門課的「單堂尖峰報名人數」——逐 (課程, 日期, 時段) 加總後取最大值。"""
    rows = (
        db.query(
            Reservation.course_id,
            Reservation.booking_date,
            Reservation.start_hour,
            func.coalesce(func.sum(Reservation.people_count), 0),
        )
        .filter(Reservation.course_id.isnot(None), Reservation.status.in_(_ENROLLED_STATUSES))
        .group_by(Reservation.course_id, Reservation.booking_date, Reservation.start_hour)
        .all()
    )
    peak: dict[int, int] = {}
    for course_id, _d, _h, total in rows:
        peak[course_id] = max(peak.get(course_id, 0), int(total))
    return peak


def _to_out(course: Course, enrolled: int) -> CourseOut:
    return CourseOut.model_validate(course).model_copy(update={"enrolled_count": enrolled})


def _to_detail(course: Course, enrolled: int) -> CourseDetailOut:
    return CourseDetailOut.model_validate(course).model_copy(update={"enrolled_count": enrolled})


def _generate_code(db: Session) -> str:
    """課程編號 GC-YYYY-NNN；取當年既有編號的最大流水號 + 1（對永久刪除造成的斷號免疫）。"""
    year = datetime.utcnow().year
    prefix = f"GC-{year}-"
    rows = db.query(Course.code).filter(Course.code.like(f"{prefix}%")).all()
    max_seq = 0
    for (code,) in rows:
        try:
            max_seq = max(max_seq, int(code[len(prefix):]))
        except (TypeError, ValueError):
            continue
    return f"{prefix}{max_seq + 1:03d}"


def _sync_derived_fields(course: Course) -> None:
    """回填列表用的「主要時段」與衍生欄位。"""
    weekdays = sorted({w.weekday for w in course.weekday_rows})
    course.day_of_week = weekdays[0] if weekdays else None
    active = [s for s in course.sessions if not s.is_cancelled]
    course.session_count = len(active)
    if course.start_date and course.end_mode == ScheduleEndMode.count and course.week_count:
        course.end_date = course.start_date + timedelta(days=course.week_count * 7 - 1)


def _apply_children(course: Course, payload: CourseCreate | CourseUpdate) -> None:
    if payload.weekdays is not None:
        wanted = {w for w in payload.weekdays if 1 <= w <= 7}
        # 逐列增刪（而非整批重建），避免同一次 flush 內先 INSERT 後 DELETE
        # 觸發 uq_course_weekday 唯一鍵衝突
        existing = {row.weekday: row for row in course.weekday_rows}
        for weekday, row in existing.items():
            if weekday not in wanted:
                course.weekday_rows.remove(row)
        for weekday in sorted(wanted - existing.keys()):
            course.weekday_rows.append(CourseWeekday(weekday=weekday))
    if payload.sessions is not None:
        course.sessions = [
            CourseSession(
                position=s.position,
                session_date=s.session_date,
                start_minute=s.start_minute,
                duration_minutes=s.duration_minutes,
                source=s.source,
                is_cancelled=s.is_cancelled,
            )
            for s in payload.sessions
        ]


@router.get("", response_model=list[CourseOut], dependencies=[Depends(get_current_user)])
def list_courses(
    db: Session = Depends(get_db),
    archived: bool | None = Query(default=None, description="None=全部、true=僅封存、false=僅未封存"),
):
    """
    對應「團體課程管理列表」（管理員）；其他登入會員可讀取用於「我的預約列表」等畫面顯示課程名稱，
    僅新增／編輯限管理員。
    """
    query = db.query(Course).options(selectinload(Course.weekday_rows))
    if archived is not None:
        query = query.filter(Course.is_archived.is_(archived))
    counts = _enrolled_counts(db)
    return [_to_out(c, counts.get(c.id, 0)) for c in query.all()]


@router.get(
    "/coach-sessions",
    response_model=list[CoachCourseSessionOut],
    dependencies=[Depends(get_current_user)],
)
def list_coach_sessions(
    coach_id: int = Query(..., description="教練 id"),
    db: Session = Depends(get_db),
):
    """
    對應「教練課程」頁：某教練所有**未封存**課程（上架／下架／草稿皆納入）的逐堂課堂，
    含停課紀錄（`is_cancelled` 照實回傳，由前端標示）。以課程 `coach_id` 關聯。
    """
    rows = (
        db.query(
            CourseSession.session_date,
            CourseSession.start_minute,
            CourseSession.duration_minutes,
            CourseSession.source,
            CourseSession.is_cancelled,
            Course.id,
            Course.name,
            Course.code,
            Course.status,
        )
        .join(Course, CourseSession.course_id == Course.id)
        .filter(Course.coach_id == coach_id, Course.is_archived.is_(False))
        .order_by(CourseSession.session_date, CourseSession.start_minute)
        .all()
    )
    return [
        CoachCourseSessionOut(
            course_id=course_id_,
            course_name=course_name,
            course_code=course_code,
            course_status=course_status,
            session_date=session_date,
            start_minute=start_minute,
            duration_minutes=duration_minutes,
            source=source,
            is_cancelled=is_cancelled,
        )
        for (
            session_date,
            start_minute,
            duration_minutes,
            source,
            is_cancelled,
            course_id_,
            course_name,
            course_code,
            course_status,
        ) in rows
    ]


@router.get("/{course_id}", response_model=CourseDetailOut, dependencies=[Depends(get_current_user)])
def get_course(course_id: int, db: Session = Depends(get_db)):
    """對應「編輯／複製團體課程」：回傳含排程規格（weekdays）與逐堂課堂的完整資料。"""
    course = (
        db.query(Course)
        .options(selectinload(Course.weekday_rows), selectinload(Course.sessions))
        .filter(Course.id == course_id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到課程")
    counts = _enrolled_counts(db)
    return _to_detail(course, counts.get(course.id, 0))


@router.post("", response_model=CourseDetailOut, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """對應「新增團體課程」：課程資訊、排程規格、逐堂課堂、狀態。"""
    course = Course(
        name=payload.name,
        coach_id=payload.coach_id,
        duration_minutes=payload.duration_minutes,
        min_capacity=payload.min_capacity,
        max_capacity=payload.max_capacity,
        description=payload.description,
        cover_image_url=payload.cover_image_url,
        status=payload.status,
        start_hour=payload.start_hour,
        start_date=payload.start_date,
        end_mode=payload.end_mode,
        end_date=payload.end_date,
        week_count=payload.week_count,
    )
    course.code = _generate_code(db)
    course.updated_by_name = current_user.username
    _apply_children(course, payload)
    _sync_derived_fields(course)
    db.add(course)
    db.commit()
    db.refresh(course)
    return _to_detail(course, 0)


@router.put("/{course_id}", response_model=CourseDetailOut)
def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    course = (
        db.query(Course)
        .options(selectinload(Course.weekday_rows), selectinload(Course.sessions))
        .filter(Course.id == course_id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到課程")

    for field in (
        "name",
        "coach_id",
        "duration_minutes",
        "min_capacity",
        "max_capacity",
        "description",
        "cover_image_url",
        "status",
        "start_hour",
        "start_date",
        "end_mode",
        "end_date",
        "week_count",
    ):
        value = getattr(payload, field)
        if value is not None:
            setattr(course, field, value)
    _apply_children(course, payload)
    _sync_derived_fields(course)
    course.updated_by_name = current_user.username
    db.commit()
    db.refresh(course)
    counts = _enrolled_counts(db)
    return _to_detail(course, counts.get(course.id, 0))


@router.patch("/{course_id}/status", response_model=CourseOut)
def update_course_status(
    course_id: int,
    payload: CourseStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """對應列表頁的「上架／下架」即時切換。"""
    course = db.query(Course).options(selectinload(Course.weekday_rows)).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到課程")
    course.status = payload.status
    course.updated_by_name = current_user.username
    db.commit()
    db.refresh(course)
    counts = _enrolled_counts(db)
    return _to_out(course, counts.get(course.id, 0))


@router.post("/{course_id}/archive", response_model=CourseOut)
def archive_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """對應「編輯團體課程」底部的「封存」：移出課程列表，改由封存課程頁管理。"""
    course = db.query(Course).options(selectinload(Course.weekday_rows)).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到課程")
    course.is_archived = True
    course.archived_at = datetime.utcnow()
    course.archived_by_name = current_user.username
    db.commit()
    db.refresh(course)
    counts = _enrolled_counts(db)
    return _to_out(course, counts.get(course.id, 0))


@router.post("/{course_id}/restore", response_model=CourseOut)
def restore_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """對應「封存課程」頁的「還原」：回到課程列表並維持下架狀態。"""
    course = db.query(Course).options(selectinload(Course.weekday_rows)).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到課程")
    course.is_archived = False
    course.archived_at = None
    course.archived_by_name = None
    course.status = CourseStatus.off
    course.updated_by_name = current_user.username
    db.commit()
    db.refresh(course)
    counts = _enrolled_counts(db)
    return _to_out(course, counts.get(course.id, 0))


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """對應「封存課程」頁的「永久刪除」：僅允許已封存且無預約參照的課程。"""
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到課程")
    if not course.is_archived:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="請先封存課程再永久刪除")
    has_reservation = (
        db.query(Reservation.id).filter(Reservation.course_id == course_id).first() is not None
    )
    if has_reservation:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="此課程仍有預約紀錄，無法永久刪除")
    db.delete(course)
    db.commit()


@router.post(
    "/upload-cover",
    response_model=CourseCoverOut,
    dependencies=[Depends(require_admin)],
)
async def upload_cover(file: UploadFile = File(...)):
    """對應「新增／編輯團體課程」課程封面上傳：存檔後回傳 /media 相對網址供寫入 cover_image_url。"""
    ext = COVER_CONTENT_TYPES.get(file.content_type or "")
    if ext is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="僅支援 jpg、png 格式")

    data = await file.read()
    if len(data) > COVER_MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="檔案超過 2MB，請壓縮後再上傳")

    target_dir = os.path.join(settings.MEDIA_DIR, "courses")
    os.makedirs(target_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(target_dir, filename), "wb") as fh:
        fh.write(data)

    return CourseCoverOut(url=f"/media/courses/{filename}")

import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.db.session import get_db
from app.deps import get_current_user, require_admin
from app.models.course import (
    Course,
    CourseScheduleRule,
    CourseSession,
    CourseStatus,
)
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User
from app.schemas.course import (
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
    """一次撈出每門課的已報名人數（people_count 加總）。"""
    rows = (
        db.query(Reservation.course_id, func.coalesce(func.sum(Reservation.people_count), 0))
        .filter(Reservation.course_id.isnot(None), Reservation.status.in_(_ENROLLED_STATUSES))
        .group_by(Reservation.course_id)
        .all()
    )
    return {course_id: int(total) for course_id, total in rows}


def _to_out(course: Course, enrolled: int) -> CourseOut:
    return CourseOut.model_validate(course).model_copy(update={"enrolled_count": enrolled})


def _to_detail(course: Course, enrolled: int) -> CourseDetailOut:
    return CourseDetailOut.model_validate(course).model_copy(update={"enrolled_count": enrolled})


def _generate_code(db: Session) -> str:
    year = datetime.utcnow().year
    seq = db.query(func.count(Course.id)).filter(Course.code.like(f"GC-{year}-%")).scalar() or 0
    return f"GC-{year}-{seq + 1:03d}"


def _sync_derived_fields(course: Course) -> None:
    """依 sessions 回填列表用的「主要時段」與衍生欄位。"""
    ordered = sorted(course.sessions, key=lambda s: (s.session_date, s.start_minute))
    course.session_count = len(ordered)
    if ordered:
        first, last = ordered[0], ordered[-1]
        course.start_date = first.session_date
        course.end_date = last.session_date
        course.day_of_week = first.session_date.isoweekday()  # 1=週一 … 7=週日
        course.start_hour = first.start_minute // 60
    else:
        course.start_date = None
        course.end_date = None
        course.day_of_week = None
        course.start_hour = None


def _apply_children(course: Course, payload: CourseCreate | CourseUpdate) -> None:
    if payload.rules is not None:
        course.rules = [
            CourseScheduleRule(
                position=r.position,
                start_date=r.start_date,
                start_minute=r.start_minute,
                frequency=r.frequency,
                end_mode=r.end_mode,
                week_count=r.week_count,
                end_date=r.end_date,
            )
            for r in payload.rules
        ]
    if payload.sessions is not None:
        course.sessions = [
            CourseSession(
                position=s.position,
                session_date=s.session_date,
                start_minute=s.start_minute,
                duration_minutes=s.duration_minutes,
                source=s.source,
                rule_position=s.rule_position,
                adjusted=s.adjusted,
                origin_date=s.origin_date,
                origin_minute=s.origin_minute,
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
    query = db.query(Course)
    if archived is not None:
        query = query.filter(Course.is_archived.is_(archived))
    counts = _enrolled_counts(db)
    return [_to_out(c, counts.get(c.id, 0)) for c in query.all()]


@router.get("/{course_id}", response_model=CourseDetailOut, dependencies=[Depends(get_current_user)])
def get_course(course_id: int, db: Session = Depends(get_db)):
    """對應「編輯／複製團體課程」：回傳含排課規則與逐堂課堂的完整資料。"""
    course = (
        db.query(Course)
        .options(selectinload(Course.rules), selectinload(Course.sessions))
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
    """對應「新增團體課程」：課程資訊、排課規則、逐堂課堂、狀態。"""
    course = Course(
        name=payload.name,
        coach_id=payload.coach_id,
        duration_minutes=payload.duration_minutes,
        min_capacity=payload.min_capacity,
        max_capacity=payload.max_capacity,
        description=payload.description,
        cover_image_url=payload.cover_image_url,
        status=payload.status,
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
        .options(selectinload(Course.rules), selectinload(Course.sessions))
        .filter(Course.id == course_id)
        .first()
    )
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到課程")

    for field in ("name", "coach_id", "duration_minutes", "min_capacity", "max_capacity", "description", "cover_image_url", "status"):
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
    course = db.get(Course, course_id)
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
    course = db.get(Course, course_id)
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
    course = db.get(Course, course_id)
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

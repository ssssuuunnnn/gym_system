from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user, require_admin
from app.models.course import Course
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User
from app.schemas.course import CourseCreate, CourseOut, CourseStatusUpdate, CourseUpdate

router = APIRouter(prefix="/courses", tags=["courses"])

# 計入「已報名人數」的預約狀態（待確認 + 已確認）
_ENROLLED_STATUSES = [ReservationStatus.pending, ReservationStatus.confirmed]


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
    return CourseOut(**{k: v for k, v in course.__dict__.items() if not k.startswith("_")}, enrolled_count=enrolled)


def _generate_code(db: Session) -> str:
    year = datetime.utcnow().year
    seq = db.query(func.count(Course.id)).filter(Course.code.like(f"GC-{year}-%")).scalar() or 0
    return f"GC-{year}-{seq + 1:03d}"


@router.get("", response_model=list[CourseOut], dependencies=[Depends(get_current_user)])
def list_courses(db: Session = Depends(get_db)):
    """
    對應「團體課程管理列表」（管理員）；其他登入會員可讀取用於「我的預約列表」等畫面顯示課程名稱，
    僅新增／編輯限管理員。
    """
    counts = _enrolled_counts(db)
    return [_to_out(c, counts.get(c.id, 0)) for c in db.query(Course).all()]


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """對應「新增團體課程」：課程資訊、開課期間、狀態。"""
    course = Course(**payload.model_dump())
    course.code = _generate_code(db)
    course.updated_by_name = current_user.username
    db.add(course)
    db.commit()
    db.refresh(course)
    return _to_out(course, 0)


@router.put("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到課程")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(course, field, value)
    course.updated_by_name = current_user.username
    db.commit()
    db.refresh(course)
    counts = _enrolled_counts(db)
    return _to_out(course, counts.get(course.id, 0))


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

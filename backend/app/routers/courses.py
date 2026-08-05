from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user, require_admin
from app.models.course import Course
from app.schemas.course import CourseCreate, CourseOut, CourseUpdate

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=list[CourseOut], dependencies=[Depends(get_current_user)])
def list_courses(db: Session = Depends(get_db)):
    """
    對應「課程管理列表」（管理員）；其他登入會員可讀取用於「我的預約列表」等畫面顯示課程名稱，
    僅新增／編輯限管理員。
    """
    return db.query(Course).all()


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_course(payload: CourseCreate, db: Session = Depends(get_db)):
    """對應「建立／編輯課程」：課程名稱、時段、綁定教練、人數上限（3-8）。"""
    course = Course(**payload.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.put("/{course_id}", response_model=CourseOut, dependencies=[Depends(require_admin)])
def update_course(course_id: int, payload: CourseUpdate, db: Session = Depends(get_db)):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到課程")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(course, field, value)
    db.commit()
    db.refresh(course)
    return course

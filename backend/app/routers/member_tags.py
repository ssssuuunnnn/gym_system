"""
會員標籤（見 docs/adr/0012-news-and-tags.md、R50）：店家自訂標籤，在會員詳情貼到會員身上，
會員列表與會員名單可依標籤篩選，最新消息可以用 LINE 發給有某些標籤的會員。
標籤只在後台出現，不給會員自己看。
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import get_db, require_perm
from app.models.member_tag import MemberTag, MemberTagLink
from app.models.user import User, UserRole
from app.schemas.member_tag import MemberTagIn, MemberTagOut, TagMembersIn

router = APIRouter(prefix="/member-tags", tags=["member-tags"])

# 讀取：會員管理、會員名單、最新消息（發送時選標籤）都會用到；修改：會員管理或會員名單
require_read = require_perm("members", "segments", "website")
require_edit = require_perm("members", "segments")


def _actor(user: User) -> str:
    return user.display_name or user.username


def _get(db: Session, tag_id: int) -> MemberTag:
    tag = db.get(MemberTag, tag_id)
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到這個標籤")
    return tag


def _out(db: Session, tags: list[MemberTag]) -> list[MemberTagOut]:
    ids = [t.id for t in tags]
    counts: dict[int, tuple[int, int]] = {}
    if ids:
        rows = (
            db.query(
                MemberTagLink.tag_id,
                func.count(User.id),
                func.count(User.id).filter(User.line_user_id.isnot(None), User.marketing_consent_at.isnot(None)),
            )
            .join(User, User.id == MemberTagLink.user_id)
            .filter(MemberTagLink.tag_id.in_(ids), User.role == UserRole.member, User.is_blacklisted.is_(False))
            .group_by(MemberTagLink.tag_id)
            .all()
        )
        counts = {tag_id: (total, sendable) for tag_id, total, sendable in rows}
    return [
        MemberTagOut(
            id=t.id,
            name=t.name,
            color=t.color,
            member_count=counts.get(t.id, (0, 0))[0],
            sendable_count=counts.get(t.id, (0, 0))[1],
            created_at=t.created_at,
        )
        for t in tags
    ]


@router.get("", response_model=list[MemberTagOut], dependencies=[Depends(require_read)])
def list_tags(db: Session = Depends(get_db)):
    return _out(db, db.query(MemberTag).order_by(MemberTag.name).all())


@router.post("", response_model=MemberTagOut, status_code=status.HTTP_201_CREATED)
def create_tag(payload: MemberTagIn, db: Session = Depends(get_db), current_user: User = Depends(require_edit)):
    tag = MemberTag(name=payload.name, color=payload.color, created_by_name=_actor(current_user))
    db.add(tag)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="已經有同名的標籤")
    return _out(db, [tag])[0]


@router.put("/{tag_id}", response_model=MemberTagOut, dependencies=[Depends(require_edit)])
def update_tag(tag_id: int, payload: MemberTagIn, db: Session = Depends(get_db)):
    tag = _get(db, tag_id)
    tag.name, tag.color = payload.name, payload.color
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="已經有同名的標籤")
    return _out(db, [tag])[0]


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_edit)])
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    """刪除標籤（會員身上的這個標籤一起拿掉，會員本身不受影響）。"""
    db.delete(_get(db, tag_id))
    db.commit()


@router.post("/{tag_id}/members", response_model=MemberTagOut)
def add_members(
    tag_id: int, payload: TagMembersIn, db: Session = Depends(get_db), current_user: User = Depends(require_edit)
):
    """幫一批會員加上這個標籤（例如會員名單篩出來的人）；已經有的略過，非會員帳號忽略。"""
    tag = _get(db, tag_id)
    wanted = set(payload.user_ids)
    members = {
        uid for (uid,) in db.query(User.id).filter(User.id.in_(wanted), User.role == UserRole.member)
    }
    existing = {
        uid for (uid,) in db.query(MemberTagLink.user_id).filter(
            MemberTagLink.tag_id == tag.id, MemberTagLink.user_id.in_(members)
        )
    }
    actor = _actor(current_user)
    for uid in members - existing:
        db.add(MemberTagLink(tag_id=tag.id, user_id=uid, added_by_name=actor))
    db.commit()
    return _out(db, [tag])[0]


@router.post("/{tag_id}/members/remove", response_model=MemberTagOut, dependencies=[Depends(require_edit)])
def remove_members(tag_id: int, payload: TagMembersIn, db: Session = Depends(get_db)):
    tag = _get(db, tag_id)
    db.query(MemberTagLink).filter(
        MemberTagLink.tag_id == tag.id, MemberTagLink.user_id.in_(payload.user_ids)
    ).delete(synchronize_session=False)
    db.commit()
    return _out(db, [tag])[0]

"""
會員名單（管理員）：依上課紀錄篩會員，上傳成 LINE 受眾，再到 LINE 官方帳號後台發行銷訊息。
見 docs/adr/0006-member-segments.md、R31–R33。
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_db, require_perm
from app.models.line_audience import LineAudience
from app.models.user import User
from app.schemas.member_segment import AudienceCreate, AudienceOut, SegmentFilters, SegmentResult
from app.services import line_oa as oa
from app.services import member_segments as segments
from app.services.line import LineApiError

router = APIRouter(prefix="/member-segments", tags=["member-segments"])

# 後台功能權限（ADR 0008）：這個檔案的管理用 API 都屬於「segments」功能
require_access = require_perm("segments")


@router.post("/preview", response_model=SegmentResult, dependencies=[Depends(require_access)])
def preview(filters: SegmentFilters, db: Session = Depends(get_db)):
    """符合條件的會員與人數（可發送／未綁定 LINE／未同意優惠訊息）。"""
    return segments.summarize(segments.find_members(db, filters))


@router.post("/audiences", response_model=AudienceOut, status_code=status.HTTP_201_CREATED)
def create_audience(
    payload: AudienceCreate, current_user: User = Depends(require_access), db: Session = Depends(get_db)
):
    """
    把名單裡「可發送」的會員上傳成 LINE 受眾。名單在伺服器重新篩一次，不信任前端傳來的會員。
    受眾本身不發訊息、不計費；在 LINE 官方帳號後台用這個受眾群發時才算訊息則數。
    """
    channel = oa.get_enabled_channel(db)
    if channel is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="請先在系統設定啟用 LINE 官方帳號")
    rows = segments.find_members(db, payload.filters)
    line_ids = [u.line_user_id for u, m in rows if m.reach == "可發送"]
    if not line_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="名單裡沒有可以發送 LINE 訊息的會員")
    client = oa.client_for(channel)
    if client is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="金鑰無法解密，請重新設定 LINE 官方帳號")
    name = payload.name.strip()
    try:
        group_id = client.create_audience(name, line_ids)
    except LineApiError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"LINE 建立受眾失敗：{exc.message[:150]}")
    audience = LineAudience(
        name=name,
        audience_group_id=group_id,
        filters=payload.filters.model_dump(mode="json"),
        member_count=len(line_ids),
        created_by_name=current_user.display_name or current_user.username,
    )
    db.add(audience)
    db.commit()
    db.refresh(audience)
    return audience


@router.get("/audiences", response_model=list[AudienceOut], dependencies=[Depends(require_access)])
def list_audiences(db: Session = Depends(get_db)):
    return db.query(LineAudience).order_by(LineAudience.id.desc()).limit(50).all()

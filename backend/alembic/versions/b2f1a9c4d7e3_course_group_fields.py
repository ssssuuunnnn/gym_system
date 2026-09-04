"""course group fields

Revision ID: b2f1a9c4d7e3
Revises: c3e2b8a4f1d5
Create Date: 2026-09-02 10:00:00.000000

新增「團體課程管理列表」所需欄位：課程編號、開班人數下限、單堂時長、課堂數、
課程介紹、封面圖、開課起訖日、狀態、最後編輯時間／編輯者。
既有資料：status 回填為「上架」，其餘帶 server_default 或允許 NULL。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b2f1a9c4d7e3'
down_revision: Union[str, None] = 'c3e2b8a4f1d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# SQLAlchemy 的 Enum 預設以 enum 成員「名稱」入庫（與本專案既有 productcategory /
# reservationstatus migration 一致），API 層再由 Pydantic 轉回中文 value。
_course_status = sa.Enum('on', 'off', 'draft', name='coursestatus')


def upgrade() -> None:
    op.add_column('courses', sa.Column('code', sa.String(length=20), nullable=True, comment='課程編號 GC-YYYY-NNN'))
    op.add_column('courses', sa.Column('duration_minutes', sa.SmallInteger(), nullable=False, server_default='60', comment='單堂時長（分鐘）'))
    op.add_column('courses', sa.Column('min_capacity', sa.SmallInteger(), nullable=False, server_default='1', comment='最低開班人數'))
    op.add_column('courses', sa.Column('session_count', sa.SmallInteger(), nullable=False, server_default='0', comment='課堂數'))
    op.add_column('courses', sa.Column('description', sa.Text(), nullable=True, comment='課程介紹'))
    op.add_column('courses', sa.Column('cover_image_url', sa.String(length=500), nullable=True, comment='封面圖網址'))
    op.add_column('courses', sa.Column('start_date', sa.Date(), nullable=True, comment='開課起日'))
    op.add_column('courses', sa.Column('end_date', sa.Date(), nullable=True, comment='開課訖日'))
    op.add_column('courses', sa.Column('status', _course_status, nullable=False, server_default='on'))
    op.add_column('courses', sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')))
    op.add_column('courses', sa.Column('updated_by_name', sa.String(length=100), nullable=True, comment='最後編輯者帳號'))
    op.create_unique_constraint('uq_courses_code', 'courses', ['code'])
    op.alter_column('courses', 'max_capacity', existing_type=sa.SmallInteger(), existing_nullable=False, comment='報名人數上限', existing_comment='人數上限 3-8')


def downgrade() -> None:
    op.alter_column('courses', 'max_capacity', existing_type=sa.SmallInteger(), existing_nullable=False, comment='人數上限 3-8', existing_comment='報名人數上限')
    op.drop_constraint('uq_courses_code', 'courses', type_='unique')
    for col in (
        'updated_by_name', 'updated_at', 'status', 'end_date', 'start_date',
        'cover_image_url', 'description', 'session_count', 'min_capacity',
        'duration_minutes', 'code',
    ):
        op.drop_column('courses', col)
    _course_status.drop(op.get_bind(), checkfirst=True)

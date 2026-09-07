"""group course schedule rules & sessions, archive fields

Revision ID: d4e5f6a7b8c9
Revises: 2cd565e061e5
Create Date: 2026-09-06 12:00:00.000000

團體課程「新增／編輯／複製」所需：
- courses 加封存欄位（is_archived / archived_at / archived_by_name）
- courses.day_of_week / start_hour 改為可為 NULL（草稿可無任何課堂）
- 新增 course_schedule_rules（排課規則列）與 course_sessions（逐堂課堂）

SQLAlchemy 的 Enum 以成員「名稱」入庫（weekly/biweekly、count/date、rule/extra），
API 層由 Pydantic 轉回中文 value。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = '2cd565e061e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_frequency = sa.Enum('weekly', 'biweekly', name='schedulefrequency')
_end_mode = sa.Enum('count', 'date', name='scheduleendmode')
_session_source = sa.Enum('rule', 'extra', name='sessionsource')


def upgrade() -> None:
    op.add_column('courses', sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='0', comment='是否已封存'))
    op.add_column('courses', sa.Column('archived_at', sa.DateTime(), nullable=True, comment='封存時間'))
    op.add_column('courses', sa.Column('archived_by_name', sa.String(length=100), nullable=True, comment='封存者帳號'))
    op.alter_column('courses', 'day_of_week', existing_type=sa.SmallInteger(), nullable=True)
    op.alter_column('courses', 'start_hour', existing_type=sa.SmallInteger(), nullable=True)

    op.create_table(
        'course_schedule_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('position', sa.SmallInteger(), nullable=False, comment='列順序，對應「規則 1 / 2…」'),
        sa.Column('start_date', sa.Date(), nullable=False, comment='規則起始日'),
        sa.Column('start_minute', sa.SmallInteger(), nullable=False, comment='開始時間，自午夜起算分鐘'),
        sa.Column('frequency', _frequency, nullable=False),
        sa.Column('end_mode', _end_mode, nullable=False),
        sa.Column('week_count', sa.SmallInteger(), nullable=True, comment='連續週數（end_mode=count）'),
        sa.Column('end_date', sa.Date(), nullable=True, comment='結束日（end_mode=date）'),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_course_schedule_rules_course_id', 'course_schedule_rules', ['course_id'])

    op.create_table(
        'course_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('position', sa.SmallInteger(), nullable=False, comment='顯示順序'),
        sa.Column('session_date', sa.Date(), nullable=False),
        sa.Column('start_minute', sa.SmallInteger(), nullable=False, comment='開始時間，自午夜起算分鐘'),
        sa.Column('duration_minutes', sa.SmallInteger(), nullable=False),
        sa.Column('source', _session_source, nullable=False),
        sa.Column('rule_position', sa.SmallInteger(), nullable=True, comment='來源規則序號；單次加開為 NULL'),
        sa.Column('adjusted', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('origin_date', sa.Date(), nullable=True, comment='調整前日期（adjusted 時填）'),
        sa.Column('origin_minute', sa.SmallInteger(), nullable=True, comment='調整前開始時間（adjusted 時填）'),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_course_sessions_course_id', 'course_sessions', ['course_id'])


def downgrade() -> None:
    op.drop_index('ix_course_sessions_course_id', table_name='course_sessions')
    op.drop_table('course_sessions')
    op.drop_index('ix_course_schedule_rules_course_id', table_name='course_schedule_rules')
    op.drop_table('course_schedule_rules')

    op.alter_column('courses', 'start_hour', existing_type=sa.SmallInteger(), nullable=False)
    op.alter_column('courses', 'day_of_week', existing_type=sa.SmallInteger(), nullable=False)
    op.drop_column('courses', 'archived_by_name')
    op.drop_column('courses', 'archived_at')
    op.drop_column('courses', 'is_archived')

    bind = op.get_bind()
    _session_source.drop(bind, checkfirst=True)
    _end_mode.drop(bind, checkfirst=True)
    _frequency.drop(bind, checkfirst=True)

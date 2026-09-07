"""group course: single schedule spec (drop rules, add weekdays)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-08 09:00:00.000000

團體課程排課由「多條排課規則」收斂成「一門課一份排程規格」：
- 移除 course_schedule_rules；改把排程掛在 courses（weekdays 另立小表 + end_mode/week_count）
- course_sessions 改結構：去 rule_position/adjusted/origin_*，加 is_cancelled，source 值改 scheduled/extra
- 直接清掉現有課程測試資料，不做 rule → spec 轉換
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_end_mode = sa.Enum('count', 'date', name='scheduleendmode')
_session_source_new = sa.Enum('scheduled', 'extra', name='sessionsource')


def upgrade() -> None:
    # 清掉現有課程測試資料（含子表，透過 FK CASCADE）；先解開 reservations 的參照
    op.execute("UPDATE reservations SET course_id = NULL WHERE course_id IS NOT NULL")
    op.execute("DELETE FROM courses")

    # DROP TABLE 會一併移除其索引與外鍵；不可單獨 drop FK 需要的索引（MySQL 1553）
    op.execute("DROP TABLE IF EXISTS course_schedule_rules")
    op.drop_table('course_sessions')

    op.add_column('courses', sa.Column('end_mode', _end_mode, nullable=True, comment='開課期間結束方式：週數 / 結束日'))
    op.add_column('courses', sa.Column('week_count', sa.SmallInteger(), nullable=True, comment='開課週數（end_mode=count）'))

    op.create_table(
        'course_weekdays',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('weekday', sa.SmallInteger(), nullable=False, comment='ISO 星期 1–7'),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_id', 'weekday', name='uq_course_weekday'),
    )
    op.create_index('ix_course_weekdays_course_id', 'course_weekdays', ['course_id'])

    op.create_table(
        'course_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('position', sa.SmallInteger(), nullable=False, comment='顯示順序'),
        sa.Column('session_date', sa.Date(), nullable=False),
        sa.Column('start_minute', sa.SmallInteger(), nullable=False, comment='開始時間，自午夜起算分鐘'),
        sa.Column('duration_minutes', sa.SmallInteger(), nullable=False),
        sa.Column('source', _session_source_new, nullable=False),
        sa.Column('is_cancelled', sa.Boolean(), nullable=False, server_default='0', comment='停課（保留紀錄）'),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_course_sessions_course_id', 'course_sessions', ['course_id'])


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_table('course_sessions')
    op.drop_table('course_weekdays')
    op.drop_column('courses', 'week_count')
    op.drop_column('courses', 'end_mode')
    _session_source_new.drop(bind, checkfirst=True)

    _frequency = sa.Enum('weekly', 'biweekly', name='schedulefrequency')
    _end_mode_old = sa.Enum('count', 'date', name='scheduleendmode')
    _session_source_old = sa.Enum('rule', 'extra', name='sessionsource')

    op.create_table(
        'course_schedule_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('position', sa.SmallInteger(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('start_minute', sa.SmallInteger(), nullable=False),
        sa.Column('frequency', _frequency, nullable=False),
        sa.Column('end_mode', _end_mode_old, nullable=False),
        sa.Column('week_count', sa.SmallInteger(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_course_schedule_rules_course_id', 'course_schedule_rules', ['course_id'])

    op.create_table(
        'course_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('position', sa.SmallInteger(), nullable=False),
        sa.Column('session_date', sa.Date(), nullable=False),
        sa.Column('start_minute', sa.SmallInteger(), nullable=False),
        sa.Column('duration_minutes', sa.SmallInteger(), nullable=False),
        sa.Column('source', _session_source_old, nullable=False),
        sa.Column('rule_position', sa.SmallInteger(), nullable=True),
        sa.Column('adjusted', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('origin_date', sa.Date(), nullable=True),
        sa.Column('origin_minute', sa.SmallInteger(), nullable=True),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_course_sessions_course_id', 'course_sessions', ['course_id'])

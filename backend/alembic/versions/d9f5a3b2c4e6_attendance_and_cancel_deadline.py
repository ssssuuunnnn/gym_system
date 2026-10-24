"""reservations attendance + cancel deadline (簽到／出席狀態、取消期限)

Revision ID: d9f5a3b2c4e6
Revises: c8e4f2a1b3d5
Create Date: 2026-10-24 16:00:00.000000

- reservations：attendance（已出席／未到）、checked_in_at、checked_in_by、late_cancel
- system_settings：cancel_deadline_hours（預設 12 小時；0＝不限制）
既有資料：attendance 為 NULL（未簽到）、late_cancel 為 0。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd9f5a3b2c4e6'
down_revision: Union[str, None] = 'c8e4f2a1b3d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 入庫值為 enum 成員名稱（見 CLAUDE.md）
_attendance_enum = sa.Enum('attended', 'no_show', name='attendance')


def upgrade() -> None:
    op.add_column(
        'reservations',
        sa.Column('late_cancel', sa.Boolean(), nullable=False, server_default='0', comment='是否為期限內取消'),
    )
    op.add_column('reservations', sa.Column('attendance', _attendance_enum, nullable=True, comment='出席狀態'))
    op.add_column(
        'reservations', sa.Column('checked_in_at', sa.DateTime(), nullable=True, comment='標記出席狀態的時間')
    )
    op.add_column('reservations', sa.Column('checked_in_by', sa.Integer(), nullable=True, comment='標記者'))
    op.create_foreign_key(
        'fk_reservations_checked_in_by_users', 'reservations', 'users', ['checked_in_by'], ['id']
    )
    op.add_column(
        'system_settings',
        sa.Column(
            'cancel_deadline_hours', sa.SmallInteger(), nullable=False, server_default='12',
            comment='取消期限（開課前小時數）',
        ),
    )


def downgrade() -> None:
    op.drop_column('system_settings', 'cancel_deadline_hours')
    op.drop_constraint('fk_reservations_checked_in_by_users', 'reservations', type_='foreignkey')
    for col in ('checked_in_by', 'checked_in_at', 'attendance', 'late_cancel'):
        op.drop_column('reservations', col)

"""time_slots 改綁日期（slot_date 取代 day_of_week）

Revision ID: 77236957e44b
Revises: b2f1a9c4d7e3
Create Date: 2026-09-02 00:00:00.000000

time_slots 從每週固定樣板（day_of_week 1-6）改為綁定特定日期（slot_date），
各日期獨立、不套用到其他週。屬設定資料且無 seed，故直接重建（不保留舊 rows）。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '77236957e44b'
down_revision: Union[str, None] = 'b2f1a9c4d7e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('time_slots')
    op.create_table(
        'time_slots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('slot_date', sa.Date(), nullable=False, comment='綁定日期'),
        sa.Column('start_hour', sa.SmallInteger(), nullable=False, comment='10-21，每格60分鐘'),
        sa.Column('is_open', sa.Boolean(), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slot_date', 'start_hour', name='uq_time_slots_date_hour'),
    )


def downgrade() -> None:
    op.drop_table('time_slots')
    op.create_table(
        'time_slots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('day_of_week', sa.SmallInteger(), nullable=False, comment='1-6，週日不適用'),
        sa.Column('start_hour', sa.SmallInteger(), nullable=False, comment='10-21，每格60分鐘'),
        sa.Column('is_open', sa.Boolean(), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('day_of_week', 'start_hour', name='uq_time_slots_day_hour'),
    )

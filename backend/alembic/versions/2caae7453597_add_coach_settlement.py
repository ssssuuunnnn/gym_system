"""add coach settlement

Revision ID: 2caae7453597
Revises: a1b2c3d4e5f6
Create Date: 2026-09-12 10:00:00.000000

新增「教練費用結算」所需的兩張表：
- coach_settlement_rates：全站僅一筆（singleton），依課程類型（團體課程／一對一／場租）
  設定共用鐘點費；不在此處灌入預設資料列，改由 routers/coach_settlements.py 於首次
  GET/PUT 時 lazy get-or-create（同 system_settings 作法）。
- coach_settlement_periods：每個結算月份（year+month）一筆，記錄是否已鎖定與鎖定時間；
  snapshot_json 保存鎖定當下計算出的結算內容（教練列表、堂數、應付金額等），
  避免日後調整鐘點費回頭影響已鎖定月份的歷史數字。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '2caae7453597'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'coach_settlement_rates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_course_rate', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('private_rate', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('venue_rental_rate', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'coach_settlement_periods',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('year', sa.SmallInteger(), nullable=False),
        sa.Column('month', sa.SmallInteger(), nullable=False),
        sa.Column('is_locked', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('locked_at', sa.DateTime(), nullable=True),
        sa.Column('snapshot_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('year', 'month', name='uq_coach_settlement_period_year_month'),
    )


def downgrade() -> None:
    op.drop_table('coach_settlement_periods')
    op.drop_table('coach_settlement_rates')

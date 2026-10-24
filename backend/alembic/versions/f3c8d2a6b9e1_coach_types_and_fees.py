"""coach types + per-session fees (教練類型、每堂教練費)

Revision ID: f3c8d2a6b9e1
Revises: e1a6b4c3d5f7
Create Date: 2026-10-24 18:00:00.000000

- coaches：教練類型 is_private_coach／is_group_coach／is_rental_coach（既有教練預設為私人教練）
- courses：coach_fee 每堂教練費（團體課程教練鐘點用，預設 0）
- coach_payout_items：fee 該堂教練費（私人課＝教練費率；團體課＝課程每堂教練費）；
  既有明細回填為所屬月結的 rate（舊版明細皆依教練費率計算）
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f3c8d2a6b9e1'
down_revision: Union[str, None] = 'e1a6b4c3d5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'coaches', sa.Column('is_private_coach', sa.Boolean(), nullable=False, server_default='1', comment='私人教練')
    )
    op.add_column(
        'coaches', sa.Column('is_group_coach', sa.Boolean(), nullable=False, server_default='0', comment='團體課程教練')
    )
    op.add_column(
        'coaches', sa.Column('is_rental_coach', sa.Boolean(), nullable=False, server_default='0', comment='場租教練')
    )
    op.add_column(
        'courses', sa.Column('coach_fee', sa.Numeric(10, 2), nullable=False, server_default='0', comment='每堂教練費')
    )
    op.add_column(
        'coach_payout_items',
        sa.Column(
            'fee', sa.Numeric(10, 2), nullable=False, server_default='0',
            comment='這堂的教練費（私人課＝教練費率；團體課＝課程每堂教練費）',
        ),
    )
    op.execute(
        'UPDATE coach_payout_items SET fee = '
        '(SELECT rate FROM coach_payouts WHERE coach_payouts.id = coach_payout_items.payout_id)'
    )


def downgrade() -> None:
    op.drop_column('coach_payout_items', 'fee')
    op.drop_column('courses', 'coach_fee')
    for col in ('is_rental_coach', 'is_group_coach', 'is_private_coach'):
        op.drop_column('coaches', col)

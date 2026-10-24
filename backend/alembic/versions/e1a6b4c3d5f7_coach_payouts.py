"""coach types + coach payouts (教練類型、教練鐘點結算)

Revision ID: e1a6b4c3d5f7
Revises: d9f5a3b2c4e6
Create Date: 2026-10-24 17:00:00.000000

- coaches：session_rate 私人課每堂鐘點費（預設 0，需由管理員在教練資料設定）；
  教練類型 is_private_coach／is_group_coach／is_rental_coach（既有教練預設為私人教練）
- courses：coach_fee 每堂教練費（團體課程教練鐘點用，預設 0）
- coach_payouts：教練月結（堂數、費率、金額快照，已結算／已撥款）
- coach_payout_items：月結明細快照（含每堂 fee）
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e1a6b4c3d5f7'
down_revision: Union[str, None] = 'd9f5a3b2c4e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 入庫值為 enum 成員名稱（見 CLAUDE.md）
_status_enum = sa.Enum('settled', 'paid', name='payoutstatus')
_kind_enum = sa.Enum('private', 'group', name='payoutitemkind')


def upgrade() -> None:
    op.add_column(
        'coaches',
        sa.Column('session_rate', sa.Numeric(10, 2), nullable=False, server_default='0', comment='私人課每堂鐘點費'),
    )
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
    op.create_table(
        'coach_payouts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('coach_id', sa.Integer(), nullable=False),
        sa.Column('period', sa.Date(), nullable=False, comment='結算月份（該月 1 日）'),
        sa.Column('session_count', sa.Integer(), nullable=False, comment='計費堂數'),
        sa.Column('rate', sa.Numeric(10, 2), nullable=False, comment='結算當下的私人課每堂鐘點費'),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False, comment='應付金額＝明細 fee 加總'),
        sa.Column('status', _status_enum, nullable=False),
        sa.Column('settled_at', sa.DateTime(), nullable=False),
        sa.Column('settled_by', sa.Integer(), nullable=False),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('paid_by', sa.Integer(), nullable=True),
        sa.Column('payment_note', sa.String(length=255), nullable=True, comment='撥款備註，例如匯款日期'),
        sa.ForeignKeyConstraint(['coach_id'], ['coaches.id']),
        sa.ForeignKeyConstraint(['settled_by'], ['users.id']),
        sa.ForeignKeyConstraint(['paid_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('coach_id', 'period', name='uq_coach_payouts_coach_period'),
    )
    op.create_index(op.f('ix_coach_payouts_coach_id'), 'coach_payouts', ['coach_id'], unique=False)
    op.create_table(
        'coach_payout_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('payout_id', sa.Integer(), nullable=False),
        sa.Column('kind', _kind_enum, nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(length=100), nullable=False, comment='課程或商品名稱（快照）'),
        sa.Column('session_date', sa.Date(), nullable=False),
        sa.Column('start_hour', sa.SmallInteger(), nullable=False),
        sa.Column(
            'fee', sa.Numeric(10, 2), nullable=False,
            comment='這堂的教練費（私人課＝教練費率；團體課＝課程每堂教練費）',
        ),
        sa.Column('attended_count', sa.SmallInteger(), nullable=False, comment='已出席人數（預約筆數）'),
        sa.Column('no_show_count', sa.SmallInteger(), nullable=False, comment='未到人數（預約筆數）'),
        sa.Column('members', sa.String(length=500), nullable=False, comment='學員帳號（快照，逗號分隔）'),
        sa.ForeignKeyConstraint(['payout_id'], ['coach_payouts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_coach_payout_items_payout_id'), 'coach_payout_items', ['payout_id'], unique=False)


def downgrade() -> None:
    # 直接刪表會一併移除索引與外鍵（MySQL 不允許先刪外鍵所需的索引）
    op.drop_table('coach_payout_items')
    op.drop_table('coach_payouts')
    op.drop_column('courses', 'coach_fee')
    for col in ('is_rental_coach', 'is_group_coach', 'is_private_coach', 'session_rate'):
        op.drop_column('coaches', col)

"""add hour_ledger (堂數異動紀錄)

Revision ID: b7d3e1f9a2c4
Revises: a1b2c3d4e5f6
Create Date: 2026-10-24 14:00:00.000000

新增 hour_ledger：purchases.remaining_hours 的每次增減都寫一筆。
既有購買紀錄依目前的 remaining_hours 回填一筆「期初餘額」，讓新舊資料都滿足
SUM(delta) == remaining_hours。注意：舊版取消預約會多退堂數，既有餘額可能不正確，
需要時請由管理員用「手動調整」更正（會留下紀錄）。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b7d3e1f9a2c4'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 入庫值為 enum 成員名稱（見 CLAUDE.md），API 層再轉回中文
_reason_enum = sa.Enum(
    'opening', 'purchase', 'reservation_deduct', 'reservation_refund', 'manual_adjust',
    name='hourledgerreason',
)


def upgrade() -> None:
    op.create_table(
        'hour_ledger',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('purchase_id', sa.Integer(), nullable=False),
        sa.Column('reservation_id', sa.Integer(), nullable=True, comment='預約扣抵／退回時關聯的預約'),
        sa.Column('delta', sa.Numeric(10, 2), nullable=False, comment='異動堂數，正數＝增加、負數＝扣抵'),
        sa.Column('balance_after', sa.Numeric(10, 2), nullable=False, comment='異動後剩餘堂數'),
        sa.Column('reason', _reason_enum, nullable=False),
        sa.Column('note', sa.String(length=255), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True, comment='操作者'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['purchase_id'], ['purchases.id']),
        sa.ForeignKeyConstraint(['reservation_id'], ['reservations.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_hour_ledger_purchase_id'), 'hour_ledger', ['purchase_id'], unique=False)
    op.create_index(op.f('ix_hour_ledger_reservation_id'), 'hour_ledger', ['reservation_id'], unique=False)

    op.execute(
        """
        INSERT INTO hour_ledger (purchase_id, reservation_id, delta, balance_after, reason, note, created_by, created_at)
        SELECT id, NULL, remaining_hours, remaining_hours, 'opening', '導入堂數異動紀錄前的餘額', NULL, CURRENT_TIMESTAMP
        FROM purchases
        WHERE remaining_hours <> 0
        """
    )


def downgrade() -> None:
    # MySQL 不允許先刪外鍵所需的索引；直接刪表會一併移除索引與外鍵
    op.drop_table('hour_ledger')

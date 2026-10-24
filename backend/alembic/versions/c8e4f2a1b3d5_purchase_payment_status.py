"""purchases: payment status (付款狀態)

Revision ID: c8e4f2a1b3d5
Revises: b7d3e1f9a2c4
Create Date: 2026-10-24 15:00:00.000000

購買紀錄新增付款狀態與總堂數：
- payment_status 待付款／已付款／已取消；既有資料一律視為「已付款」（舊流程購買即入帳）
- total_hours＝商品堂數 × 數量，既有資料依目前商品堂數回填
- payment_method / payment_note / paid_at / paid_confirmed_by / cancelled_at
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c8e4f2a1b3d5'
down_revision: Union[str, None] = 'b7d3e1f9a2c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 入庫值為 enum 成員名稱（見 CLAUDE.md）
_status_enum = sa.Enum('unpaid', 'paid', 'cancelled', name='paymentstatus')
_method_enum = sa.Enum('cash', 'transfer', 'card', 'other', name='paymentmethod')


def upgrade() -> None:
    op.add_column(
        'purchases',
        sa.Column('total_hours', sa.Numeric(10, 2), nullable=False, server_default='0', comment='購買總堂數'),
    )
    op.add_column(
        'purchases',
        sa.Column('payment_status', _status_enum, nullable=False, server_default='paid', comment='付款狀態'),
    )
    op.add_column('purchases', sa.Column('payment_method', _method_enum, nullable=True, comment='付款方式'))
    op.add_column(
        'purchases',
        sa.Column('payment_note', sa.String(length=255), nullable=True, comment='收款備註，例如轉帳末五碼'),
    )
    op.add_column('purchases', sa.Column('paid_at', sa.DateTime(), nullable=True, comment='確認收款時間'))
    op.add_column(
        'purchases',
        sa.Column('paid_confirmed_by', sa.Integer(), nullable=True, comment='確認收款的管理員'),
    )
    op.add_column('purchases', sa.Column('cancelled_at', sa.DateTime(), nullable=True))
    op.create_foreign_key(
        'fk_purchases_paid_confirmed_by_users', 'purchases', 'users', ['paid_confirmed_by'], ['id']
    )

    op.alter_column(
        'purchases', 'created_by', existing_type=sa.Integer(), existing_nullable=False,
        comment='登錄的管理員（會員自助購買時為會員本人）', existing_comment='登錄的管理員',
    )

    # 既有購買：視為建立當下已收款
    op.execute(
        """
        UPDATE purchases
        SET total_hours = quantity * (SELECT session_hours FROM products WHERE products.id = purchases.product_id),
            paid_at = created_at,
            paid_confirmed_by = created_by
        """
    )


def downgrade() -> None:
    op.alter_column(
        'purchases', 'created_by', existing_type=sa.Integer(), existing_nullable=False,
        comment='登錄的管理員', existing_comment='登錄的管理員（會員自助購買時為會員本人）',
    )
    op.drop_constraint('fk_purchases_paid_confirmed_by_users', 'purchases', type_='foreignkey')
    for col in ('cancelled_at', 'paid_confirmed_by', 'paid_at', 'payment_note', 'payment_method', 'payment_status', 'total_hours'):
        op.drop_column('purchases', col)

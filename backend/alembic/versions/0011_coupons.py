"""coupons

體驗券與折價券（ADR 0010）：coupons、member_coupons（RLS），
purchases 加原價／折抵金額／不計教練鐘點，付款方式加「體驗券」。

Revision ID: 0011_coupons
Revises: 0010_staff_notifications
Create Date: 2026-10-30 12:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db.rls import disable_tenant_rls, enable_tenant_rls


revision: str = '0011_coupons'
down_revision: Union[str, None] = '0010_staff_notifications'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

coupon_kind = sa.Enum('trial', 'discount', name='couponkind')
discount_type = sa.Enum('amount', 'percent', name='discounttype')
member_coupon_status = sa.Enum('available', 'used', 'void', name='membercouponstatus')
coupon_source = sa.Enum('code', 'staff', 'line_join', 'convert', name='couponsource')


def upgrade() -> None:
    op.execute("ALTER TYPE paymentmethod ADD VALUE IF NOT EXISTS 'coupon'")

    op.create_table('coupons',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=60), nullable=False),
    sa.Column('kind', coupon_kind, nullable=False),
    sa.Column('description', sa.String(length=200), nullable=True),
    sa.Column('code', sa.String(length=30), nullable=True),
    sa.Column('discount_type', discount_type, nullable=True),
    sa.Column('discount_value', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('min_amount', sa.Numeric(precision=10, scale=2), server_default='0', nullable=False),
    sa.Column('product_ids', sa.JSON(), server_default='[]', nullable=False),
    sa.Column('trial_product_id', sa.Integer(), nullable=True),
    sa.Column('counts_for_payout', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('issue_on_line_join', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('valid_from', sa.Date(), nullable=True),
    sa.Column('valid_until', sa.Date(), nullable=True),
    sa.Column('valid_days', sa.Integer(), nullable=True),
    sa.Column('total_limit', sa.Integer(), nullable=True),
    sa.Column('per_member_limit', sa.Integer(), server_default='1', nullable=False),
    sa.Column('new_member_only', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('created_by_name', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('tenant_id', sa.Integer(), nullable=False, comment='所屬租戶'),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['trial_product_id'], ['products.id']),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('tenant_id', 'code', name='uq_coupons_tenant_code')
    )
    op.create_index(op.f('ix_coupons_tenant_id'), 'coupons', ['tenant_id'], unique=False)
    enable_tenant_rls('coupons')

    op.create_table('member_coupons',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('coupon_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('status', member_coupon_status, nullable=False),
    sa.Column('source', coupon_source, nullable=False),
    sa.Column('issued_by_name', sa.String(length=100), nullable=True),
    sa.Column('issued_at', sa.DateTime(), nullable=False),
    sa.Column('expires_on', sa.Date(), nullable=True),
    sa.Column('used_at', sa.DateTime(), nullable=True),
    sa.Column('purchase_id', sa.Integer(), nullable=True),
    sa.Column('voided_at', sa.DateTime(), nullable=True),
    sa.Column('void_reason', sa.String(length=100), nullable=True),
    sa.Column('tenant_id', sa.Integer(), nullable=False, comment='所屬租戶'),
    sa.ForeignKeyConstraint(['coupon_id'], ['coupons.id']),
    sa.ForeignKeyConstraint(['purchase_id'], ['purchases.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_member_coupons_coupon_id'), 'member_coupons', ['coupon_id'], unique=False)
    op.create_index(op.f('ix_member_coupons_user_id'), 'member_coupons', ['user_id'], unique=False)
    op.create_index(op.f('ix_member_coupons_tenant_id'), 'member_coupons', ['tenant_id'], unique=False)
    enable_tenant_rls('member_coupons')

    op.add_column('purchases', sa.Column('original_amount', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('purchases', sa.Column('discount_amount', sa.Numeric(precision=10, scale=2), server_default='0', nullable=False))
    op.add_column('purchases', sa.Column('payout_excluded', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('purchases', 'payout_excluded')
    op.drop_column('purchases', 'discount_amount')
    op.drop_column('purchases', 'original_amount')
    disable_tenant_rls('member_coupons')
    op.drop_index(op.f('ix_member_coupons_tenant_id'), table_name='member_coupons')
    op.drop_index(op.f('ix_member_coupons_user_id'), table_name='member_coupons')
    op.drop_index(op.f('ix_member_coupons_coupon_id'), table_name='member_coupons')
    op.drop_table('member_coupons')
    disable_tenant_rls('coupons')
    op.drop_index(op.f('ix_coupons_tenant_id'), table_name='coupons')
    op.drop_table('coupons')
    for e in (coupon_source, member_coupon_status, discount_type, coupon_kind):
        e.drop(op.get_bind(), checkfirst=True)
    # 付款方式的 'coupon' 值無法從 enum 移除（PostgreSQL 限制），保留不影響舊程式

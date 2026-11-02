"""accounting report

收支報表（ADR 0014）：
- purchases.branch_id：收入歸屬的分店（R58），舊資料依方案推定，推不出來用預設分店
- coach_payout_items.branch_id：鐘點明細所在分店，舊資料依課程／同時段預約推定
- accounting_categories、accounting_entries：手動記帳的分類與帳目

Revision ID: 0015_accounting
Revises: 0014_trial_signup
Create Date: 2026-11-02 14:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.db.rls import disable_tenant_rls, enable_tenant_rls


revision: str = '0015_accounting'
down_revision: Union[str, None] = '0014_trial_signup'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 每家的預設分店＝排序最前面的啟用分店（同 services/branches.default_branch）
DEFAULT_BRANCH = (
    "(SELECT DISTINCT ON (tenant_id) tenant_id, id FROM branches "
    "ORDER BY tenant_id, is_active DESC, sort_order, id)"
)


def upgrade() -> None:
    # migration 以資料表擁有者執行，不受 RLS 限制。還沒有分店的店家先補一間「總店」
    op.execute(
        "INSERT INTO branches (tenant_id, name, is_active, sort_order, created_at) "
        "SELECT t.id, '總店', true, 0, now() FROM tenants t "
        "WHERE NOT EXISTS (SELECT 1 FROM branches b WHERE b.tenant_id = t.id) "
        "AND (EXISTS (SELECT 1 FROM purchases p WHERE p.tenant_id = t.id) "
        "  OR EXISTS (SELECT 1 FROM coach_payout_items i WHERE i.tenant_id = t.id))"
    )

    # ---- purchases.branch_id ----
    op.add_column('purchases', sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id'), nullable=True))
    # 團體課程方案 → 課程的分店
    op.execute(
        "UPDATE purchases p SET branch_id = c.branch_id FROM products pr JOIN courses c ON c.id = pr.course_id "
        "WHERE pr.id = p.product_id"
    )
    # 只限一間分店的方案 → 那間
    op.execute(
        "UPDATE purchases p SET branch_id = pb.branch_id FROM "
        "(SELECT product_id, min(branch_id) AS branch_id FROM product_branches GROUP BY product_id HAVING count(*) = 1) pb "
        "WHERE p.branch_id IS NULL AND pb.product_id = p.product_id"
    )
    op.execute(
        f"UPDATE purchases p SET branch_id = d.id FROM {DEFAULT_BRANCH} d "
        "WHERE p.branch_id IS NULL AND d.tenant_id = p.tenant_id"
    )
    op.alter_column('purchases', 'branch_id', nullable=False)
    op.create_index(op.f('ix_purchases_branch_id'), 'purchases', ['branch_id'], unique=False)

    # ---- coach_payout_items.branch_id ----
    op.add_column(
        'coach_payout_items', sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id'), nullable=True)
    )
    op.execute(
        "UPDATE coach_payout_items i SET branch_id = c.branch_id FROM courses c WHERE c.id = i.course_id"
    )
    # 私人課：同教練、同日同時段的已確認預約
    op.execute(
        "UPDATE coach_payout_items i SET branch_id = r.branch_id FROM coach_payouts cp, reservations r "
        "WHERE i.branch_id IS NULL AND cp.id = i.payout_id AND r.coach_id = cp.coach_id "
        "AND r.course_id IS NULL AND r.booking_date = i.session_date AND r.start_hour = i.start_hour "
        "AND r.status = 'confirmed'"
    )
    op.execute(
        f"UPDATE coach_payout_items i SET branch_id = d.id FROM {DEFAULT_BRANCH} d "
        "WHERE i.branch_id IS NULL AND d.tenant_id = i.tenant_id"
    )
    op.alter_column('coach_payout_items', 'branch_id', nullable=False)
    op.create_index(op.f('ix_coach_payout_items_branch_id'), 'coach_payout_items', ['branch_id'], unique=False)

    # ---- 手動記帳 ----
    entry_kind = postgresql.ENUM('income', 'expense', name='entrykind')
    entry_kind.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'accounting_categories',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('kind', postgresql.ENUM(name='entrykind', create_type=False), nullable=False),
        sa.Column('name', sa.String(30), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sort_order', sa.SmallInteger(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('tenant_id', 'kind', 'name', name='uq_accounting_categories_name'),
    )
    enable_tenant_rls('accounting_categories')

    op.create_table(
        'accounting_entries',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('kind', postgresql.ENUM(name='entrykind', create_type=False), nullable=False),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('accounting_categories.id'), nullable=False, index=True),
        sa.Column('entry_date', sa.Date(), nullable=False, index=True, comment='收付日期（店家當地日期）'),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('payment_method', postgresql.ENUM(name='paymentmethod', create_type=False), nullable=False),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id'), nullable=True, index=True),
        sa.Column('note', sa.String(200), nullable=True),
        sa.Column('created_by_name', sa.String(100), nullable=True),
        sa.Column('updated_by_name', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_by_name', sa.String(100), nullable=True),
    )
    enable_tenant_rls('accounting_entries')


def downgrade() -> None:
    disable_tenant_rls('accounting_entries')
    op.drop_table('accounting_entries')
    disable_tenant_rls('accounting_categories')
    op.drop_table('accounting_categories')
    postgresql.ENUM(name='entrykind').drop(op.get_bind(), checkfirst=True)
    op.drop_index(op.f('ix_coach_payout_items_branch_id'), table_name='coach_payout_items')
    op.drop_column('coach_payout_items', 'branch_id')
    op.drop_index(op.f('ix_purchases_branch_id'), table_name='purchases')
    op.drop_column('purchases', 'branch_id')

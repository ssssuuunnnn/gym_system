"""accounting phase 2

收支報表第二期（ADR 0015）：accounting_closes（關帳）、accounting_entries.receipt_path（收據，存在不公開的資料夾）。
權責制與預收款由既有資料計算，不新增資料表。

Revision ID: 0016_accounting_phase2
Revises: 0015_accounting
Create Date: 2026-11-02 22:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db.rls import disable_tenant_rls, enable_tenant_rls


revision: str = '0016_accounting_phase2'
down_revision: Union[str, None] = '0015_accounting'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('accounting_entries', sa.Column('receipt_path', sa.String(200), nullable=True))
    op.create_table(
        'accounting_closes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('period', sa.Date(), nullable=False, comment='月份（該月 1 日）'),
        sa.Column('is_closed', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('closed_at', sa.DateTime(), nullable=False),
        sa.Column('closed_by_name', sa.String(100), nullable=True),
        sa.Column('reopened_at', sa.DateTime(), nullable=True),
        sa.Column('reopened_by_name', sa.String(100), nullable=True),
        sa.Column('snapshot', sa.JSON(), nullable=False),
        sa.UniqueConstraint('tenant_id', 'period', name='uq_accounting_closes_period'),
    )
    enable_tenant_rls('accounting_closes')


def downgrade() -> None:
    disable_tenant_rls('accounting_closes')
    op.drop_table('accounting_closes')
    op.drop_column('accounting_entries', 'receipt_path')

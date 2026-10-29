"""branches

分店（ADR 0007）：branches、coach_branches、product_branches（RLS）；
courses／reservations／time_slots 加 branch_id。既有資料：每家健身房建立「總店」，
所有課程、預約、公休與教練都歸到總店；公休的唯一鍵改成以分店為單位。

Revision ID: 0008_branches
Revises: 0007_member_segments
Create Date: 2026-10-29 17:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db.rls import disable_tenant_rls, enable_tenant_rls


revision: str = '0008_branches'
down_revision: Union[str, None] = '0007_member_segments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BRANCHED = ('courses', 'reservations', 'time_slots')


def _tenant_col():
    return sa.Column('tenant_id', sa.Integer(), nullable=False, comment='所屬租戶')


def upgrade() -> None:
    op.create_table('branches',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=50), nullable=False),
    sa.Column('address', sa.String(length=200), nullable=True),
    sa.Column('phone', sa.String(length=30), nullable=True),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('sort_order', sa.SmallInteger(), server_default='0', nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    _tenant_col(),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('tenant_id', 'name', name='uq_branches_tenant_name')
    )
    op.create_index(op.f('ix_branches_tenant_id'), 'branches', ['tenant_id'], unique=False)
    enable_tenant_rls('branches')

    for table, owner, fk in (('coach_branches', 'coach_id', 'coaches'), ('product_branches', 'product_id', 'products')):
        op.create_table(table,
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column(owner, sa.Integer(), nullable=False),
        sa.Column('branch_id', sa.Integer(), nullable=False),
        _tenant_col(),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint([owner], [f'{fk}.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(owner, 'branch_id', name=f"uq_{owner.removesuffix('_id')}_branch")
        )
        op.create_index(op.f(f'ix_{table}_tenant_id'), table, ['tenant_id'], unique=False)
        op.create_index(op.f(f'ix_{table}_{owner}'), table, [owner], unique=False)
        op.create_index(op.f(f'ix_{table}_branch_id'), table, ['branch_id'], unique=False)
        enable_tenant_rls(table)

    # 既有資料：每家健身房一間「總店」（migration 以資料表擁有者執行，不受 RLS 限制）
    op.execute("INSERT INTO branches (tenant_id, name, is_active, sort_order, created_at) "
               "SELECT id, '總店', true, 0, now() FROM tenants")
    for table in BRANCHED:
        op.add_column(table, sa.Column('branch_id', sa.Integer(), nullable=True))
        op.execute(f"UPDATE {table} t SET branch_id = b.id FROM branches b WHERE b.tenant_id = t.tenant_id")
        op.alter_column(table, 'branch_id', nullable=False)
        op.create_foreign_key(f'fk_{table}_branch_id', table, 'branches', ['branch_id'], ['id'])
        op.create_index(op.f(f'ix_{table}_branch_id'), table, ['branch_id'], unique=False)
    op.execute("INSERT INTO coach_branches (tenant_id, coach_id, branch_id) "
               "SELECT c.tenant_id, c.id, b.id FROM coaches c JOIN branches b ON b.tenant_id = c.tenant_id")

    op.drop_constraint('uq_time_slots_tenant_date_hour', 'time_slots', type_='unique')
    op.create_unique_constraint('uq_time_slots_branch_date_hour', 'time_slots',
                                ['tenant_id', 'branch_id', 'slot_date', 'start_hour'])


def downgrade() -> None:
    # 只保留每家健身房排序最前面的分店的公休，其餘分店的公休會被刪除
    op.execute("DELETE FROM time_slots t USING branches b WHERE b.id = t.branch_id AND b.id <> "
               "(SELECT b2.id FROM branches b2 WHERE b2.tenant_id = t.tenant_id ORDER BY b2.sort_order, b2.id LIMIT 1)")
    op.drop_constraint('uq_time_slots_branch_date_hour', 'time_slots', type_='unique')
    op.create_unique_constraint('uq_time_slots_tenant_date_hour', 'time_slots', ['tenant_id', 'slot_date', 'start_hour'])
    for table in BRANCHED:
        op.drop_index(op.f(f'ix_{table}_branch_id'), table_name=table)
        op.drop_constraint(f'fk_{table}_branch_id', table, type_='foreignkey')
        op.drop_column(table, 'branch_id')
    for table, owner in (('product_branches', 'product_id'), ('coach_branches', 'coach_id')):
        disable_tenant_rls(table)
        op.drop_index(op.f(f'ix_{table}_branch_id'), table_name=table)
        op.drop_index(op.f(f'ix_{table}_{owner}'), table_name=table)
        op.drop_index(op.f(f'ix_{table}_tenant_id'), table_name=table)
        op.drop_table(table)
    disable_tenant_rls('branches')
    op.drop_index(op.f('ix_branches_tenant_id'), table_name='branches')
    op.drop_table('branches')

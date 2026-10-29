"""staff permissions

後台多使用者與功能權限（ADR 0008）：users.staff_level（主要管理者／管理者／一般使用者）、
users.permissions、users.is_active，以及 staff_audit_logs（RLS）。
既有資料：每家最早建立的管理員設為主要管理者，其他管理員設為管理者（權限不會變少）。

Revision ID: 0009_staff_permissions
Revises: 0008_branches
Create Date: 2026-10-29 18:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db.rls import disable_tenant_rls, enable_tenant_rls


revision: str = '0009_staff_permissions'
down_revision: Union[str, None] = '0008_branches'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

staff_level = sa.Enum('owner', 'manager', 'staff', name='stafflevel')


def upgrade() -> None:
    staff_level.create(op.get_bind(), checkfirst=True)
    op.add_column('users', sa.Column('staff_level', staff_level, nullable=True))
    op.add_column('users', sa.Column('permissions', sa.JSON(), server_default='[]', nullable=False))
    op.add_column('users', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
    op.execute("UPDATE users SET staff_level = 'manager' WHERE role = 'admin'")
    op.execute(
        "UPDATE users SET staff_level = 'owner' WHERE id IN "
        "(SELECT min(id) FROM users WHERE role = 'admin' GROUP BY tenant_id)"
    )

    op.create_table('staff_audit_logs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('actor_id', sa.Integer(), nullable=True),
    sa.Column('actor_name', sa.String(length=100), nullable=False),
    sa.Column('target_id', sa.Integer(), nullable=True),
    sa.Column('target_name', sa.String(length=100), nullable=True),
    sa.Column('action', sa.String(length=30), nullable=False),
    sa.Column('detail', sa.String(length=300), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('tenant_id', sa.Integer(), nullable=False, comment='所屬租戶'),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_staff_audit_logs_created_at'), 'staff_audit_logs', ['created_at'], unique=False)
    op.create_index(op.f('ix_staff_audit_logs_tenant_id'), 'staff_audit_logs', ['tenant_id'], unique=False)
    enable_tenant_rls('staff_audit_logs')


def downgrade() -> None:
    disable_tenant_rls('staff_audit_logs')
    op.drop_index(op.f('ix_staff_audit_logs_tenant_id'), table_name='staff_audit_logs')
    op.drop_index(op.f('ix_staff_audit_logs_created_at'), table_name='staff_audit_logs')
    op.drop_table('staff_audit_logs')
    op.drop_column('users', 'is_active')
    op.drop_column('users', 'permissions')
    op.drop_column('users', 'staff_level')
    staff_level.drop(op.get_bind(), checkfirst=True)

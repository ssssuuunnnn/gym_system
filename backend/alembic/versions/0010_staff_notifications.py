"""staff notifications

後台鈴鐺通知（ADR 0009）：staff_notifications，每位收件人一筆，RLS。

Revision ID: 0010_staff_notifications
Revises: 0009_staff_permissions
Create Date: 2026-10-29 20:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db.rls import disable_tenant_rls, enable_tenant_rls


revision: str = '0010_staff_notifications'
down_revision: Union[str, None] = '0009_staff_permissions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

kind = sa.Enum('booking_submitted', 'booking_cancelled', 'order_unpaid', 'inquiry_new', name='staffnotificationkind')


def upgrade() -> None:
    op.create_table('staff_notifications',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('kind', kind, nullable=False),
    sa.Column('title', sa.String(length=100), nullable=False),
    sa.Column('body', sa.String(length=300), nullable=False),
    sa.Column('link', sa.String(length=300), nullable=False),
    sa.Column('read_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('tenant_id', sa.Integer(), nullable=False, comment='所屬租戶'),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_staff_notifications_created_at'), 'staff_notifications', ['created_at'], unique=False)
    op.create_index(op.f('ix_staff_notifications_tenant_id'), 'staff_notifications', ['tenant_id'], unique=False)
    op.create_index('ix_staff_notifications_user_id_id', 'staff_notifications', ['user_id', 'id'], unique=False)
    enable_tenant_rls('staff_notifications')


def downgrade() -> None:
    disable_tenant_rls('staff_notifications')
    op.drop_index('ix_staff_notifications_user_id_id', table_name='staff_notifications')
    op.drop_index(op.f('ix_staff_notifications_tenant_id'), table_name='staff_notifications')
    op.drop_index(op.f('ix_staff_notifications_created_at'), table_name='staff_notifications')
    op.drop_table('staff_notifications')
    kind.drop(op.get_bind(), checkfirst=True)

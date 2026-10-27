"""line member messages

健身房官方帳號推播給會員（ADR 0005 第二階段）：line_member_messages（RLS）、
line_oa_channels 的通知開關與上課提醒時間、users.line_notify（會員自己可關閉）。

Revision ID: 0006_line_member
Revises: 0005_line_oa
Create Date: 2026-10-25 13:34:44.413053

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.db.rls import disable_tenant_rls, enable_tenant_rls


# revision identifiers, used by Alembic.
revision: str = '0006_line_member'
down_revision: Union[str, None] = '0005_line_oa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('line_member_messages',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('event', sa.Enum('booking_confirmed', 'booking_rejected', 'booking_cancelled', 'payment_confirmed', 'class_reminder', name='linememberevent'), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('message', sa.JSON(), nullable=True),
    sa.Column('status', postgresql.ENUM(name='linenotificationstatus', create_type=False), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('next_attempt_at', sa.DateTime(), nullable=False),
    sa.Column('note', sa.String(length=200), nullable=True),
    sa.Column('dedupe_key', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('tenant_id', sa.Integer(), nullable=False, comment='所屬租戶'),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('tenant_id', 'dedupe_key', name='uq_line_member_messages_dedupe')
    )
    op.create_index(op.f('ix_line_member_messages_created_at'), 'line_member_messages', ['created_at'], unique=False)
    op.create_index(op.f('ix_line_member_messages_tenant_id'), 'line_member_messages', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_line_member_messages_user_id'), 'line_member_messages', ['user_id'], unique=False)
    enable_tenant_rls('line_member_messages')
    op.add_column('line_oa_channels', sa.Column('notify_booking_result', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('line_oa_channels', sa.Column('notify_booking_cancel', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('line_oa_channels', sa.Column('notify_payment_confirmed', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('line_oa_channels', sa.Column('notify_class_reminder', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('line_oa_channels', sa.Column('reminder_hour', sa.SmallInteger(), server_default='20', nullable=False))
    op.add_column('line_oa_channels', sa.Column('member_monthly_cap', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('line_notify', sa.Boolean(), server_default='true', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'line_notify')
    op.drop_column('line_oa_channels', 'member_monthly_cap')
    op.drop_column('line_oa_channels', 'reminder_hour')
    op.drop_column('line_oa_channels', 'notify_class_reminder')
    op.drop_column('line_oa_channels', 'notify_payment_confirmed')
    op.drop_column('line_oa_channels', 'notify_booking_cancel')
    op.drop_column('line_oa_channels', 'notify_booking_result')
    disable_tenant_rls('line_member_messages')
    op.drop_index(op.f('ix_line_member_messages_user_id'), table_name='line_member_messages')
    op.drop_index(op.f('ix_line_member_messages_tenant_id'), table_name='line_member_messages')
    op.drop_index(op.f('ix_line_member_messages_created_at'), table_name='line_member_messages')
    op.drop_table('line_member_messages')
    sa.Enum(name='linememberevent').drop(op.get_bind(), checkfirst=True)

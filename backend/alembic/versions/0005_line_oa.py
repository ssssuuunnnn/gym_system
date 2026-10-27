"""gym line oa

健身房自己的 LINE 官方帳號（見 docs/adr/0005-gym-line-oa.md）：
- 租戶表 line_oa_channels（RLS；channel secret／access token 加密保存）
- users：姓名、手機、LINE 綁定（同一家健身房內 LINE 帳號唯一）
- system_settings.payment_instructions（付款方式說明）

Revision ID: 0005_line_oa
Revises: 0004_line
Create Date: 2026-10-25 13:05:08.849392

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db.rls import disable_tenant_rls, enable_tenant_rls


# revision identifiers, used by Alembic.
revision: str = '0005_line_oa'
down_revision: Union[str, None] = '0004_line'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('line_oa_channels',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('channel_secret_enc', sa.Text(), nullable=False),
    sa.Column('access_token_enc', sa.Text(), nullable=False),
    sa.Column('login_channel_id', sa.String(length=20), nullable=False),
    sa.Column('liff_id', sa.String(length=64), nullable=False),
    sa.Column('is_enabled', sa.Boolean(), nullable=False),
    sa.Column('bot_basic_id', sa.String(length=40), nullable=True),
    sa.Column('bot_name', sa.String(length=100), nullable=True),
    sa.Column('bot_picture_url', sa.String(length=500), nullable=True),
    sa.Column('rich_menu_id', sa.String(length=80), nullable=True),
    sa.Column('verified_at', sa.DateTime(), nullable=True),
    sa.Column('last_error', sa.String(length=500), nullable=True),
    sa.Column('updated_by_name', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('tenant_id', sa.Integer(), nullable=False, comment='所屬租戶'),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('tenant_id', name='uq_line_oa_channels_tenant')
    )
    op.create_index(op.f('ix_line_oa_channels_tenant_id'), 'line_oa_channels', ['tenant_id'], unique=False)
    enable_tenant_rls('line_oa_channels')
    op.add_column('system_settings', sa.Column('payment_instructions', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('display_name', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('phone', sa.String(length=30), nullable=True))
    op.add_column('users', sa.Column('line_user_id', sa.String(length=64), nullable=True))
    op.add_column('users', sa.Column('line_display_name', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('line_linked_at', sa.DateTime(), nullable=True))
    op.create_unique_constraint('uq_users_tenant_line_user', 'users', ['tenant_id', 'line_user_id'])


def downgrade() -> None:
    op.drop_constraint('uq_users_tenant_line_user', 'users', type_='unique')
    op.drop_column('users', 'line_linked_at')
    op.drop_column('users', 'line_display_name')
    op.drop_column('users', 'line_user_id')
    op.drop_column('users', 'phone')
    op.drop_column('users', 'display_name')
    op.drop_column('system_settings', 'payment_instructions')
    disable_tenant_rls('line_oa_channels')
    op.drop_index(op.f('ix_line_oa_channels_tenant_id'), table_name='line_oa_channels')
    op.drop_table('line_oa_channels')

"""member segments

會員名單與 LINE 受眾（ADR 0006）：line_audiences（RLS）、users.marketing_consent_at（行銷訊息同意）。

Revision ID: 0007_member_segments
Revises: 0006_line_member
Create Date: 2026-10-28 22:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db.rls import disable_tenant_rls, enable_tenant_rls


revision: str = '0007_member_segments'
down_revision: Union[str, None] = '0006_line_member'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('line_audiences',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('audience_group_id', sa.BigInteger(), nullable=False),
    sa.Column('filters', sa.JSON(), nullable=False),
    sa.Column('member_count', sa.Integer(), nullable=False),
    sa.Column('created_by_name', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('tenant_id', sa.Integer(), nullable=False, comment='所屬租戶'),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_line_audiences_created_at'), 'line_audiences', ['created_at'], unique=False)
    op.create_index(op.f('ix_line_audiences_tenant_id'), 'line_audiences', ['tenant_id'], unique=False)
    enable_tenant_rls('line_audiences')
    op.add_column('users', sa.Column('marketing_consent_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'marketing_consent_at')
    disable_tenant_rls('line_audiences')
    op.drop_index(op.f('ix_line_audiences_tenant_id'), table_name='line_audiences')
    op.drop_index(op.f('ix_line_audiences_created_at'), table_name='line_audiences')
    op.drop_table('line_audiences')

"""news and member tags

最新消息與會員標籤（ADR 0012）：news_posts、news_broadcasts（每次 LINE 發送），
member_tags、member_tag_links；會員推播多一種事件「最新消息」。

Revision ID: 0013_news
Revises: 0012_business_type
Create Date: 2026-10-31 21:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db.rls import disable_tenant_rls, enable_tenant_rls


revision: str = '0013_news'
down_revision: Union[str, None] = '0012_business_type'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE … ADD VALUE 不能在交易裡和使用它的語句一起跑：放在 autocommit 區塊
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE linememberevent ADD VALUE IF NOT EXISTS 'news'")

    op.create_table(
        'news_posts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('title', sa.String(80), nullable=False),
        sa.Column('summary', sa.String(200), nullable=False, server_default=''),
        sa.Column('body', sa.Text(), nullable=False, server_default=''),
        sa.Column('image_url', sa.String(300), nullable=True),
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('published_at', sa.DateTime(), nullable=True, index=True),
        sa.Column('created_by_name', sa.String(100), nullable=True),
        sa.Column('updated_by_name', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    enable_tenant_rls('news_posts')

    op.create_table(
        'news_broadcasts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('news_id', sa.Integer(), sa.ForeignKey('news_posts.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('tag_ids', sa.JSON(), nullable=False),
        sa.Column('filters', sa.JSON(), nullable=True),
        sa.Column('target_label', sa.String(300), nullable=False, server_default=''),
        sa.Column('matched_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('queued_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_by_name', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    enable_tenant_rls('news_broadcasts')

    op.create_table(
        'member_tags',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(20), nullable=False),
        sa.Column('color', sa.String(20), nullable=False, server_default='blue'),
        sa.Column('created_by_name', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('tenant_id', 'name', name='uq_member_tags_tenant_name'),
    )
    enable_tenant_rls('member_tags')

    op.create_table(
        'member_tag_links',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('tag_id', sa.Integer(), sa.ForeignKey('member_tags.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('added_by_name', sa.String(100), nullable=True),
        sa.Column('added_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('tag_id', 'user_id', name='uq_member_tag_links'),
    )
    enable_tenant_rls('member_tag_links')


def downgrade() -> None:
    for table in ('member_tag_links', 'member_tags', 'news_broadcasts', 'news_posts'):
        disable_tenant_rls(table)
        op.drop_table(table)
    # PostgreSQL 不能移除 enum 的值；只把用到它的列刪掉
    op.execute("DELETE FROM line_member_messages WHERE event = 'news'")

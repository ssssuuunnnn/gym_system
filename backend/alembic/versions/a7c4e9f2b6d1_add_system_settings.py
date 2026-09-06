"""add system settings

Revision ID: a7c4e9f2b6d1
Revises: b2f1a9c4d7e3
Create Date: 2026-09-05 10:00:00.000000

新增「系統設定 → 基本資料」所需的 system_settings 表：全站僅一筆（singleton），
儲存公司名稱、顯示簡稱、公司 LOGO 網址。不在此處灌入預設資料列，改由
routers/system_settings.py 於首次 GET/PUT 時 lazy get-or-create。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a7c4e9f2b6d1'
down_revision: Union[str, None] = 'b2f1a9c4d7e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'system_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_name', sa.String(length=100), nullable=False),
        sa.Column('short_name', sa.String(length=50), nullable=True),
        sa.Column('logo_url', sa.String(length=255), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('system_settings')

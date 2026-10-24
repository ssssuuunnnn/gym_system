"""product original price (商品原價)

Revision ID: a4d9e7c1b2f3
Revises: f3c8d2a6b9e1
Create Date: 2026-10-24 19:00:00.000000

- products：新增 original_price 原價；既有商品回填為目前價格（price 即售價，實際收費不變）
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a4d9e7c1b2f3'
down_revision: Union[str, None] = 'f3c8d2a6b9e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'products',
        sa.Column('original_price', sa.Numeric(10, 2), nullable=False, server_default='0', comment='原價'),
    )
    op.execute('UPDATE products SET original_price = price')
    op.alter_column(
        'products', 'original_price',
        existing_type=sa.Numeric(10, 2), existing_nullable=False, server_default=None, existing_comment='原價',
    )
    op.alter_column(
        'products', 'price',
        existing_type=sa.Numeric(10, 2), existing_nullable=False, comment='售價（實際收費）',
    )


def downgrade() -> None:
    op.alter_column(
        'products', 'price',
        existing_type=sa.Numeric(10, 2), existing_nullable=False, comment=None, existing_comment='售價（實際收費）',
    )
    op.drop_column('products', 'original_price')

"""product category: add single_course (單次課程)

Revision ID: a1b2c3d4e5f6
Revises: f6a7b8c9d0e1
Create Date: 2026-09-08 14:00:00.000000

商品分類新增「課程」（單次課程，`single_course`）：堂數由管理員自填，不綁團體課程。
只擴充 enum 值，既有資料不受影響。MySQL 以 MODIFY COLUMN 變更 ENUM，SQLite 略過。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_old_enum = sa.Enum('course', 'supply', name='productcategory')
_new_enum = sa.Enum('course', 'single_course', 'supply', name='productcategory')


def upgrade() -> None:
    if op.get_bind().dialect.name != 'sqlite':
        op.alter_column('products', 'category', existing_type=_old_enum, type_=_new_enum, existing_nullable=False)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'sqlite':
        return
    # 回滾前把「課程」商品併回「用品」，避免 enum 縮窄時殘留非法值
    op.execute("UPDATE products SET category = 'supply', session_hours = 0 WHERE category = 'single_course'")
    op.alter_column('products', 'category', existing_type=_new_enum, type_=_old_enum, existing_nullable=False)

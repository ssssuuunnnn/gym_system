"""product category: course / supply

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-08 12:00:00.000000

商品分類由 8 值（私人教練1對1/1對2、場租1對1、包場、團體課、自主訓練、臨時加人、手綁帶）
簡化為「課程 / 用品」兩值，並新增：
- course_id：分類為「課程」時綁定的團體課程（堂數沿用該課程的課堂數）
- stock：分類為「用品」時的庫存量（登錄購買時扣減）

既有資料轉換：category='group_class' → 'course'（不自動綁課程，留空待管理員補），
其餘一律 → 'supply'，且用品的 session_hours 歸零。

Enum 沿用「以成員名稱入庫」慣例；MySQL 以 MODIFY COLUMN 變更 ENUM，
SQLite（本機便利用途）不強制 ENUM，略過型別變更。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_NAMES = (
    'private_1v1', 'private_1v2', 'rental_1v1', 'buyout',
    'group_class', 'self_training', 'extra_person', 'hand_wrap',
)
_NEW_NAMES = ('course', 'supply')

_old_enum = sa.Enum(*_OLD_NAMES, name='productcategory')
_superset_enum = sa.Enum(*_OLD_NAMES, *_NEW_NAMES, name='productcategory')
_new_enum = sa.Enum(*_NEW_NAMES, name='productcategory')


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == 'sqlite'

    op.add_column('products', sa.Column('course_id', sa.Integer(), nullable=True, comment='分類為課程時綁定的團體課程'))
    op.add_column('products', sa.Column('stock', sa.Integer(), nullable=True, comment='用品庫存量'))
    if not is_sqlite:
        op.create_foreign_key('fk_products_course_id', 'products', 'courses', ['course_id'], ['id'])
        # 先加寬成「舊值＋新值」的 superset，讓下一步的 UPDATE 在 MySQL 合法
        op.alter_column('products', 'category', existing_type=_old_enum, type_=_superset_enum, existing_nullable=False)

    op.execute("UPDATE products SET category = 'course' WHERE category = 'group_class'")
    op.execute("UPDATE products SET category = 'supply' WHERE category <> 'course'")
    op.execute("UPDATE products SET session_hours = 0 WHERE category = 'supply'")

    if not is_sqlite:
        op.alter_column('products', 'category', existing_type=_superset_enum, type_=_new_enum, existing_nullable=False)


def downgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == 'sqlite'

    if not is_sqlite:
        op.alter_column('products', 'category', existing_type=_new_enum, type_=_superset_enum, existing_nullable=False)
    # 無法還原原始細分類，一律回填為 group_class（團體課）
    op.execute("UPDATE products SET category = 'group_class' WHERE category IN ('course', 'supply')")
    if not is_sqlite:
        op.alter_column('products', 'category', existing_type=_superset_enum, type_=_old_enum, existing_nullable=False)
        op.drop_constraint('fk_products_course_id', 'products', type_='foreignkey')

    op.drop_column('products', 'stock')
    op.drop_column('products', 'course_id')

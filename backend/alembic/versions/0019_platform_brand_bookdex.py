"""平台品牌名稱改為「Bookdex 預約簿」

- platform_settings.brand_name 的預設值改成新名稱
- 還在用舊預設值「店家預約管理系統」的那一筆一起更新；平台管理員在「形象頁設定」改過的名稱不動

Revision ID: 0019_platform_brand_bookdex
Revises: 0018_setup_bonus
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019_platform_brand_bookdex"
down_revision: Union[str, None] = "0018_setup_bonus"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_NAME = "店家預約管理系統"
NEW_NAME = "Bookdex 預約簿"


def upgrade() -> None:
    op.alter_column("platform_settings", "brand_name", server_default=NEW_NAME)
    op.execute(
        sa.text("UPDATE platform_settings SET brand_name = :new WHERE brand_name = :old").bindparams(
            new=NEW_NAME, old=OLD_NAME
        )
    )


def downgrade() -> None:
    op.alter_column("platform_settings", "brand_name", server_default=OLD_NAME)
    op.execute(
        sa.text("UPDATE platform_settings SET brand_name = :old WHERE brand_name = :new").bindparams(
            new=NEW_NAME, old=OLD_NAME
        )
    )

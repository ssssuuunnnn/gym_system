"""business type

行業類型（ADR 0011）：tenants.business_type（健身／美體，既有資料為健身），
system_settings.group_classes_setting（團體課程功能開關，None＝依行業預設）。

Revision ID: 0012_business_type
Revises: 0011_coupons
Create Date: 2026-10-30 19:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0012_business_type'
down_revision: Union[str, None] = '0011_coupons'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

business_type = sa.Enum('fitness', 'beauty', name='businesstype')


def upgrade() -> None:
    business_type.create(op.get_bind(), checkfirst=True)
    op.add_column('tenants', sa.Column('business_type', business_type, server_default='fitness', nullable=False,
                                       comment='行業類型'))
    op.add_column('system_settings', sa.Column('group_classes_setting', sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column('system_settings', 'group_classes_setting')
    op.drop_column('tenants', 'business_type')
    business_type.drop(op.get_bind(), checkfirst=True)

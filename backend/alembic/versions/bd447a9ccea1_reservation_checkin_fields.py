"""reservation checkin fields

Revision ID: bd447a9ccea1
Revises: 2caae7453597
Create Date: 2026-09-12 14:08:28.542868

新增「課程報到」所需的報到欄位，掛在既有 reservations 表上（報到本質是某筆已確認預約的
出席紀錄，不另建關聯表）：checked_in_at（報到時間）、checked_in_method（kiosk_self 自助報到 /
admin_manual 管理員手動報到）、checked_in_by（手動報到時記錄操作管理員，供稽核）。三欄皆可為
NULL，代表尚未報到；多數既有預約不會回填。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'bd447a9ccea1'
down_revision: Union[str, None] = '2caae7453597'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_checkin_method = sa.Enum('kiosk_self', 'admin_manual', name='reservationcheckinmethod')


def upgrade() -> None:
    op.add_column('reservations', sa.Column('checked_in_at', sa.DateTime(), nullable=True))
    op.add_column('reservations', sa.Column('checked_in_method', _checkin_method, nullable=True))
    op.add_column('reservations', sa.Column('checked_in_by', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_reservations_checked_in_by', 'reservations', 'users', ['checked_in_by'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_reservations_checked_in_by', 'reservations', type_='foreignkey')
    op.drop_column('reservations', 'checked_in_by')
    op.drop_column('reservations', 'checked_in_method')
    op.drop_column('reservations', 'checked_in_at')
    _checkin_method.drop(op.get_bind(), checkfirst=True)

"""add coach profile fields

Revision ID: c3e2b8a4f1d5
Revises: b2f1a9c7d3e4
Create Date: 2026-09-02 21:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3e2b8a4f1d5'
down_revision: Union[str, None] = 'b2f1a9c7d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('coaches', sa.Column('alias', sa.String(length=100), nullable=True))
    op.add_column('coaches', sa.Column('line_name', sa.String(length=100), nullable=True))
    op.add_column('coaches', sa.Column('bank_code', sa.String(length=10), nullable=True))
    op.add_column('coaches', sa.Column('bank_account', sa.String(length=30), nullable=True))
    op.add_column('coaches', sa.Column('specialty', sa.Text(), nullable=True))
    op.add_column('coaches', sa.Column('photo_url', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('coaches', 'photo_url')
    op.drop_column('coaches', 'specialty')
    op.drop_column('coaches', 'bank_account')
    op.drop_column('coaches', 'bank_code')
    op.drop_column('coaches', 'line_name')
    op.drop_column('coaches', 'alias')

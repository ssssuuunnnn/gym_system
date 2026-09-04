"""add must_change_password to users

Revision ID: b2f1a9c7d3e4
Revises: 073d85f424c1
Create Date: 2026-09-02 21:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2f1a9c7d3e4'
down_revision: Union[str, None] = '073d85f424c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'must_change_password',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.alter_column('users', 'must_change_password', server_default=None)


def downgrade() -> None:
    op.drop_column('users', 'must_change_password')

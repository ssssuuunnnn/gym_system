"""開店設定清單：記錄店家是否隱藏清單（ADR 0016）

Revision ID: 0017_onboarding
Revises: 0016_accounting_phase2
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017_onboarding"
down_revision: Union[str, None] = "0016_accounting_phase2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("system_settings", sa.Column("onboarding_dismissed_at", sa.DateTime(), nullable=True))
    op.add_column("system_settings", sa.Column("onboarding_dismissed_by", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("system_settings", "onboarding_dismissed_by")
    op.drop_column("system_settings", "onboarding_dismissed_at")

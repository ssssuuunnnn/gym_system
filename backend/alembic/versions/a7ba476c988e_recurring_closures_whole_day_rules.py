"""recurring_closures whole-day rules

Revision ID: a7ba476c988e
Revises: 776471f629f0
Create Date: 2026-09-05 09:19:18.954280

recurring_closures 從「星期＋整點小時」逐格開放樣板改為「星期＋整天，直到 expires_on」
規則列表。屬設定資料且無 seed，故直接重建（不保留舊 rows）。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7ba476c988e'
down_revision: Union[str, None] = '776471f629f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('recurring_closures')
    op.create_table(
        'recurring_closures',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('day_of_week', sa.SmallInteger(), nullable=False, comment='1-7，ISO：1=週一…7=週日'),
        sa.Column('duration_months', sa.SmallInteger(), nullable=False, comment='6/12/24/36：半年/一年/兩年/三年'),
        sa.Column('expires_on', sa.Date(), nullable=False, comment='建立/修改當下計算：today + duration_months'),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('recurring_closures')
    op.create_table(
        'recurring_closures',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('day_of_week', sa.SmallInteger(), nullable=False, comment='1-7，ISO：1=週一…7=週日'),
        sa.Column('start_hour', sa.SmallInteger(), nullable=False, comment='10-21，每格60分鐘'),
        sa.Column('is_open', sa.Boolean(), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('day_of_week', 'start_hour', name='uq_recurring_closures_dow_hour'),
    )

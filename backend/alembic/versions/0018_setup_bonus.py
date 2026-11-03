"""開店設定完成送試用天數（ADR 0016、R66）

- tenants.setup_bonus_at：送過的時間（每家只送一次）
- claim_setup_bonus()：SECURITY DEFINER。應用程式帳號對 tenants 只有 SELECT，所以延長試用由這個函式做；
  只對目前租戶（app.tenant_id）、狀態試用、有到期日、還沒到期、還沒送過的店家有效，天數固定在函式裡，
  並寫一筆平台操作紀錄。回傳新的到期時間；沒有延長時回傳 NULL。

Revision ID: 0018_setup_bonus
Revises: 0017_onboarding
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.db.rls import app_role

revision: str = "0018_setup_bonus"
down_revision: Union[str, None] = "0017_onboarding"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 與 app/services/onboarding.py SETUP_BONUS_DAYS 一致
BONUS_DAYS = 10


def upgrade() -> None:
    op.add_column("tenants", sa.Column("setup_bonus_at", sa.DateTime(), nullable=True))
    op.execute(
        f"""
CREATE OR REPLACE FUNCTION claim_setup_bonus()
RETURNS timestamp
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  tid int := NULLIF(current_setting('app.tenant_id', true), '')::int;
  now_utc timestamp := (now() AT TIME ZONE 'utc');
  new_end timestamp;
BEGIN
  IF tid IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE tenants
     SET trial_ends_at = trial_ends_at + make_interval(days => {BONUS_DAYS}),
         setup_bonus_at = now_utc
   WHERE id = tid
     AND status = 'trial'
     AND trial_ends_at IS NOT NULL
     AND trial_ends_at > now_utc
     AND setup_bonus_at IS NULL
  RETURNING trial_ends_at INTO new_end;
  IF new_end IS NOT NULL THEN
    INSERT INTO platform_audit_logs (admin_id, admin_username, tenant_id, action, detail, created_at)
    VALUES (NULL, '開店設定完成', tid, 'setup_bonus',
            json_build_object('days', {BONUS_DAYS}, 'to', new_end), now_utc);
  END IF;
  RETURN new_end;
END
$$
"""
    )
    op.execute("REVOKE ALL ON FUNCTION claim_setup_bonus() FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION claim_setup_bonus() TO {app_role()}")


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS claim_setup_bonus()")
    op.drop_column("tenants", "setup_bonus_at")

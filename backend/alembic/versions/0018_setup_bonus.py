"""開店設定送試用天數：每完成一項 +1 天，全部完成再 +4 天（ADR 0016、R66）

- tenants.setup_bonus_steps：已經送過天數的步驟（JSON 陣列，每一步只送一次）
- tenants.setup_bonus_at：送出「全部完成」加碼的時間
- claim_setup_bonus(done_steps text[], completed boolean)：SECURITY DEFINER。應用程式帳號對 tenants 只有 SELECT，
  所以延長試用由這個函式做。只對目前租戶（app.tenant_id）、狀態試用、有到期日、還沒到期的店家有效；
  步驟名稱與天數都寫死在函式裡（最多 6×1＋4＝10 天），並寫一筆平台操作紀錄。回傳這次送出的天數（0＝沒有送）。

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

# 與 app/services/onboarding.py 一致
REWARD_STEPS = ("profile", "payment", "staff", "plans", "website", "members")
DAYS_PER_STEP = 1
COMPLETION_DAYS = 4


def upgrade() -> None:
    op.add_column("tenants", sa.Column("setup_bonus_steps", sa.JSON(), nullable=True))
    op.add_column("tenants", sa.Column("setup_bonus_at", sa.DateTime(), nullable=True))
    steps = ", ".join(f"'{s}'" for s in REWARD_STEPS)
    op.execute(
        f"""
CREATE OR REPLACE FUNCTION claim_setup_bonus(done_steps text[], completed boolean)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  tid int := NULLIF(current_setting('app.tenant_id', true), '')::int;
  now_utc timestamp := (now() AT TIME ZONE 'utc');
  valid text[] := ARRAY[{steps}];
  t record;
  granted text[];
  new_steps text[];
  all_steps text[];
  give_completion boolean;
  days int;
BEGIN
  IF tid IS NULL THEN
    RETURN 0;
  END IF;
  SELECT id, status, trial_ends_at, setup_bonus_steps, setup_bonus_at INTO t
    FROM tenants WHERE id = tid FOR UPDATE;
  IF NOT FOUND OR t.status <> 'trial' OR t.trial_ends_at IS NULL OR t.trial_ends_at <= now_utc THEN
    RETURN 0;
  END IF;
  granted := COALESCE(ARRAY(SELECT json_array_elements_text(t.setup_bonus_steps::json)), ARRAY[]::text[]);
  -- 只認得寫死的步驟名稱，已經送過的不再送
  new_steps := ARRAY(
    SELECT DISTINCT s FROM unnest(COALESCE(done_steps, ARRAY[]::text[])) AS s
     WHERE s = ANY(valid) AND NOT (s = ANY(granted))
  );
  all_steps := granted || new_steps;
  -- 全部完成的加碼：每個步驟都送過了才算，每家一次
  give_completion := completed AND t.setup_bonus_at IS NULL AND valid <@ all_steps;
  days := cardinality(new_steps) * {DAYS_PER_STEP} + CASE WHEN give_completion THEN {COMPLETION_DAYS} ELSE 0 END;
  IF days = 0 THEN
    RETURN 0;
  END IF;
  UPDATE tenants
     SET trial_ends_at = trial_ends_at + make_interval(days => days),
         setup_bonus_steps = to_json(all_steps),
         setup_bonus_at = CASE WHEN give_completion THEN now_utc ELSE setup_bonus_at END
   WHERE id = tid;
  INSERT INTO platform_audit_logs (admin_id, admin_username, tenant_id, action, detail, created_at)
  VALUES (NULL, '開店設定', tid, 'setup_bonus',
          json_build_object('days', days, 'steps', to_json(new_steps), 'completed', give_completion,
                            'to', t.trial_ends_at + make_interval(days => days)),
          now_utc);
  RETURN days;
END
$$
"""
    )
    op.execute("REVOKE ALL ON FUNCTION claim_setup_bonus(text[], boolean) FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION claim_setup_bonus(text[], boolean) TO {app_role()}")


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS claim_setup_bonus(text[], boolean)")
    op.drop_column("tenants", "setup_bonus_at")
    op.drop_column("tenants", "setup_bonus_steps")

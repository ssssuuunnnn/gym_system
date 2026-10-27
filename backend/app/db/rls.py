"""
Migration 用的 RLS 小工具（見 docs/adr/0001-multi-tenancy.md）。

新增業務資料表時，在 migration 的 upgrade() 建表後呼叫 enable_tenant_rls("<table>")。
"""

from alembic import op

from app.core.config import settings

# 未設定租戶時 current_setting 回 '' → NULLIF 轉成 NULL → 比較結果為 NULL → 看不到也寫不進任何資料（預設拒絕）
TENANT_PREDICATE = "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int"


def app_role() -> str:
    return settings.APP_DB_ROLE


def enable_tenant_rls(table: str) -> None:
    """啟用 RLS、建立租戶隔離 policy，並授予應用程式帳號資料讀寫權限。"""
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY tenant_isolation ON {table} "
        f"USING ({TENANT_PREDICATE}) WITH CHECK ({TENANT_PREDICATE})"
    )
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO {app_role()}")


def disable_tenant_rls(table: str) -> None:
    op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
    op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")


def platform_role() -> str:
    return settings.PLATFORM_DB_ROLE

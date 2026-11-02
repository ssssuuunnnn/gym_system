"""trial signup

平台形象頁與自助試用（ADR 0013）：
- tenants.trial_ends_at（試用到期時間，UTC；NULL＝不限期）、tenants.signup_source（self＝自助申請）
- platform_settings：形象頁的品牌名稱、是否開放申請、聯絡方式（Email／LINE／電話各自可隱藏）
- trial_signups：自助申請紀錄（限制同一 IP、手機、Email 的申請次數）
- system_settings.sample_data：開通時建立的範例資料 id（「清除範例資料」用）
- platform_public_contact()：店家網址（應用程式帳號）讀取公開的聯絡方式，只回傳設定為顯示的欄位

Revision ID: 0014_trial_signup
Revises: 0013_news
Create Date: 2026-11-01 10:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db.rls import app_role, platform_role


revision: str = '0014_trial_signup'
down_revision: Union[str, None] = '0013_news'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('trial_ends_at', sa.DateTime(), nullable=True, comment='試用到期時間（UTC）'))
    op.add_column('tenants', sa.Column('signup_source', sa.String(20), nullable=True, comment='self＝形象頁自助申請'))
    op.add_column('system_settings', sa.Column('sample_data', sa.JSON(), nullable=True))

    op.create_table(
        'platform_settings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('brand_name', sa.String(60), nullable=False, server_default='店家預約管理系統'),
        sa.Column('signup_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('contact_email', sa.String(255), nullable=True),
        sa.Column('show_email', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('contact_line', sa.String(200), nullable=True),
        sa.Column('show_line', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('contact_phone', sa.String(50), nullable=True),
        sa.Column('show_phone', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.execute("INSERT INTO platform_settings (id) VALUES (1)")

    op.create_table(
        'trial_signups',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('store_name', sa.String(100), nullable=False),
        sa.Column('contact_name', sa.String(100), nullable=False),
        sa.Column('phone', sa.String(30), nullable=False, index=True),
        sa.Column('email', sa.String(255), nullable=False, index=True),
        sa.Column('ip_hash', sa.String(64), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, index=True),
    )

    role = platform_role()
    op.execute(f"GRANT SELECT, INSERT, UPDATE ON platform_settings TO {role}")
    op.execute(f"GRANT SELECT, INSERT ON trial_signups TO {role}")
    op.execute(f"GRANT USAGE, SELECT ON SEQUENCE trial_signups_id_seq TO {role}")

    # 店家網址（應用程式帳號）沒有平台表的權限：只能透過這個函式讀到「設定為顯示」的聯絡方式
    op.execute(
        """
CREATE OR REPLACE FUNCTION platform_public_contact()
RETURNS TABLE (brand_name text, email text, line text, phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT s.brand_name::text,
         CASE WHEN s.show_email THEN s.contact_email END,
         CASE WHEN s.show_line THEN s.contact_line END,
         CASE WHEN s.show_phone THEN s.contact_phone END
  FROM platform_settings s
  ORDER BY s.id
  LIMIT 1
$$
"""
    )
    op.execute("REVOKE ALL ON FUNCTION platform_public_contact() FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION platform_public_contact() TO {app_role()}")
    op.execute(f"GRANT EXECUTE ON FUNCTION platform_public_contact() TO {role}")


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS platform_public_contact()")
    op.drop_table('trial_signups')
    op.drop_table('platform_settings')
    op.drop_column('system_settings', 'sample_data')
    op.drop_column('tenants', 'signup_source')
    op.drop_column('tenants', 'trial_ends_at')

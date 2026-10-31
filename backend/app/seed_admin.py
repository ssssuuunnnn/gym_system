"""
建立／確保某家健身房的 admin 帳號存在。可重複執行（idempotent）：
- 帳號不存在 → 建立，role=admin
- 帳號已存在但 role 不是 admin → 升級為 admin
- 帳號已存在且已是 admin → 不做任何事（不會覆蓋密碼）

健身房必須已存在（python -m app.cli create-tenant）。

用法：
    python -m app.seed_admin --tenant pulsefit --username admin --password Admin@12345
    DEFAULT_TENANT=pulsefit ADMIN_USERNAME=admin ADMIN_PASSWORD=Admin@12345 python -m app.seed_admin
"""

import argparse
import os
import sys

from app.core.security import hash_password
from app.db.session import SessionLocal, tenant_session
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.services.staff import initial_level


def seed_admin(subdomain: str, username: str, password: str) -> None:
    with SessionLocal() as s:
        tenant = s.query(Tenant).filter(Tenant.subdomain == subdomain).first()
        if tenant is None:
            sys.exit(f"[seed_admin] 錯誤：找不到店家「{subdomain}」，請先執行 python -m app.cli create-tenant")
        tenant_id = tenant.id

    db = tenant_session(tenant_id)
    try:
        user = db.query(User).filter(User.username == username).first()

        if user is None:
            user = User(username=username, password_hash=hash_password(password), role=UserRole.admin,
                        staff_level=initial_level(db))
            db.add(user)
            db.commit()
            print(f"[seed_admin] {subdomain}：已建立 admin 帳號 {username}")
            return

        if user.role != UserRole.admin:
            user.role = UserRole.admin
            user.staff_level = initial_level(db)
            db.commit()
            print(f"[seed_admin] {subdomain}：已將既有帳號升級為 admin {username}")
            return

        print(f"[seed_admin] {subdomain}：admin 帳號已存在，略過 {username}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tenant", default=os.getenv("DEFAULT_TENANT"))
    parser.add_argument("--username", default=os.getenv("ADMIN_USERNAME", "admin"))
    parser.add_argument("--password", default=os.getenv("ADMIN_PASSWORD"))
    args = parser.parse_args()

    if not args.tenant:
        sys.exit("[seed_admin] 錯誤：需指定店家（--tenant 或 DEFAULT_TENANT 環境變數）")
    if not args.password:
        sys.exit("[seed_admin] 錯誤：需提供密碼（--password 或 ADMIN_PASSWORD 環境變數）")

    seed_admin(args.tenant, args.username, args.password)


if __name__ == "__main__":
    main()

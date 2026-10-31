"""
平台管理指令。以資料表擁有者（MIGRATION_DATABASE_URL）連線，不經過 API。
日常開通／停用店家請用平台管理後台（http://platform.<BASE_DOMAIN>）；這裡給部署、救援與自動化用。

用法：
    python -m app.cli create-platform-admin --username ops --password '...'
    python -m app.cli create-tenant --subdomain pulsefit --name "PulseFit 健身工作室" \\
        [--timezone Asia/Taipei] [--admin-username admin --admin-password '...']
    python -m app.cli list-tenants
    python -m app.cli set-status --subdomain pulsefit --status suspended   # trial / active / suspended
"""

import argparse
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.platform import PlatformAdmin
from app.models.tenant import BusinessType, Tenant, TenantStatus
from app.services import tenants as tenant_service
from app.services.tenants import TenantError

CLI_ACTOR = "cli"


def owner_session() -> Session:
    return Session(create_engine(settings.MIGRATION_DATABASE_URL))


def ensure_tenant(
    subdomain: str,
    name: str | None = None,
    timezone: str = "Asia/Taipei",
    admin_username: str | None = None,
    admin_password: str | None = None,
    business_type: str = "fitness",
) -> None:
    """建立店家（可選同時建立第一位管理員）；已存在則略過（可重複執行）。"""
    sub = tenant_service.normalize_subdomain(subdomain)
    with owner_session() as s:
        if s.query(Tenant.id).filter(Tenant.subdomain == sub).first():
            print(f"[cli] 店家已存在，略過：{sub}")
            return
        tenant = tenant_service.create_tenant(
            s, subdomain=sub, name=name or sub, timezone=timezone, business_type=BusinessType[business_type]
        )
        detail = {
            "subdomain": tenant.subdomain,
            "name": tenant.name,
            "timezone": tenant.timezone,
            "business_type": tenant.business_type.value,
        }
        if admin_username and admin_password:
            tenant_service.create_tenant_admin(s, tenant.id, admin_username, admin_password)
            detail["admin_username"] = admin_username
        tenant_service.audit(
            s, action="create_tenant", admin_id=None, admin_username=CLI_ACTOR, tenant_id=tenant.id, detail=detail
        )
        s.commit()
        print(f"[cli] 已建立店家：{sub}（id={tenant.id}）")


def ensure_platform_admin(username: str, password: str) -> None:
    """建立平台管理員；已存在則略過（不覆蓋密碼）。"""
    tenant_service.validate_password(password)
    with owner_session() as s:
        if s.query(PlatformAdmin.id).filter(PlatformAdmin.username == username).first():
            print(f"[cli] 平台管理員已存在，略過：{username}")
            return
        s.add(PlatformAdmin(username=username, password_hash=hash_password(password)))
        s.commit()
        print(f"[cli] 已建立平台管理員：{username}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="平台管理指令")
    sub = parser.add_subparsers(dest="command", required=True)

    p_admin = sub.add_parser("create-platform-admin", help="建立平台管理員（可重複執行）")
    p_admin.add_argument("--username", required=True)
    p_admin.add_argument("--password", required=True)

    p_create = sub.add_parser("create-tenant", help="開通一家店（可重複執行）")
    p_create.add_argument("--subdomain", required=True)
    p_create.add_argument("--name")
    p_create.add_argument("--timezone", default="Asia/Taipei")
    p_create.add_argument(
        "--type", dest="business_type", default="fitness", choices=["fitness", "beauty"], help="行業類型：fitness 健身／beauty 美體"
    )
    p_create.add_argument("--admin-username")
    p_create.add_argument("--admin-password")

    sub.add_parser("list-tenants", help="列出所有店家")

    p_status = sub.add_parser("set-status", help="變更店家狀態")
    p_status.add_argument("--subdomain", required=True)
    p_status.add_argument("--status", required=True, choices=[s.name for s in TenantStatus])

    args = parser.parse_args(argv)

    try:
        if args.command == "create-platform-admin":
            ensure_platform_admin(args.username, args.password)
        elif args.command == "create-tenant":
            ensure_tenant(
                args.subdomain, args.name, args.timezone, args.admin_username, args.admin_password, args.business_type
            )
        elif args.command == "list-tenants":
            with owner_session() as s:
                for t in s.query(Tenant).order_by(Tenant.id):
                    print(f"{t.id}\t{t.subdomain}\t{t.status.name}\t{t.business_type.name}\t{t.timezone}\t{t.name}")
        elif args.command == "set-status":
            with owner_session() as s:
                tenant = s.query(Tenant).filter(Tenant.subdomain == args.subdomain).first()
                if tenant is None:
                    sys.exit(f"[cli] 找不到店家：{args.subdomain}")
                new_status = TenantStatus[args.status]
                if tenant.status != new_status:
                    tenant_service.audit(
                        s,
                        action="set_status",
                        admin_id=None,
                        admin_username=CLI_ACTOR,
                        tenant_id=tenant.id,
                        detail={"from": tenant.status.value, "to": new_status.value},
                    )
                    tenant.status = new_status
                    s.commit()
                print(f"[cli] {args.subdomain} → {args.status}（各 API 程序最多 30 秒內生效）")
    except TenantError as exc:
        sys.exit(f"[cli] 錯誤：{exc}")


if __name__ == "__main__":
    main()

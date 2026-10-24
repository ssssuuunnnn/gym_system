"""
平台管理指令（開通健身房）。以資料表擁有者（MIGRATION_DATABASE_URL）連線，不經過租戶 API。

用法：
    python -m app.cli create-tenant --subdomain pulsefit --name "PulseFit 健身工作室" \\
        [--timezone Asia/Taipei] [--admin-username admin --admin-password '...']
    python -m app.cli list-tenants
    python -m app.cli set-status --subdomain pulsefit --status suspended   # trial / active / suspended
"""

import argparse
import sys
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.deps import SUBDOMAIN_RE
from app.models.tenant import Tenant, TenantStatus

# 平台自己會用到的子網域，不開放給健身房
RESERVED_SUBDOMAINS = {"www", "api", "app", "admin", "platform", "static", "media", "mail"}


def owner_session() -> Session:
    return Session(create_engine(settings.MIGRATION_DATABASE_URL))


def validate_subdomain(subdomain: str) -> str:
    sub = subdomain.strip().lower()
    if not SUBDOMAIN_RE.match(sub):
        raise ValueError("子網域只能用小寫英數與連字號（不可以連字號開頭或結尾），最多 63 字")
    if sub in RESERVED_SUBDOMAINS:
        raise ValueError(f"「{sub}」是平台保留的子網域")
    return sub


def ensure_tenant(subdomain: str, name: str | None = None, timezone: str = "Asia/Taipei") -> Tenant:
    """建立租戶；已存在則直接回傳（可重複執行）。"""
    sub = validate_subdomain(subdomain)
    try:
        ZoneInfo(timezone)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"未知的時區：{timezone}") from exc
    with owner_session() as s:
        tenant = s.query(Tenant).filter(Tenant.subdomain == sub).first()
        if tenant is None:
            tenant = Tenant(subdomain=sub, name=name or sub, timezone=timezone, status=TenantStatus.trial)
            s.add(tenant)
            s.commit()
            print(f"[cli] 已建立健身房：{sub}（id={tenant.id}）")
        else:
            print(f"[cli] 健身房已存在，略過：{sub}（id={tenant.id}）")
        s.refresh(tenant)
        s.expunge(tenant)
        return tenant


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="平台管理指令")
    sub = parser.add_subparsers(dest="command", required=True)

    p_create = sub.add_parser("create-tenant", help="開通一家健身房（可重複執行）")
    p_create.add_argument("--subdomain", required=True)
    p_create.add_argument("--name")
    p_create.add_argument("--timezone", default="Asia/Taipei")
    p_create.add_argument("--admin-username")
    p_create.add_argument("--admin-password")

    sub.add_parser("list-tenants", help="列出所有健身房")

    p_status = sub.add_parser("set-status", help="變更健身房狀態")
    p_status.add_argument("--subdomain", required=True)
    p_status.add_argument("--status", required=True, choices=[s.name for s in TenantStatus])

    args = parser.parse_args(argv)

    try:
        if args.command == "create-tenant":
            tenant = ensure_tenant(args.subdomain, args.name, args.timezone)
            if args.admin_username and args.admin_password:
                from app.seed_admin import seed_admin

                seed_admin(tenant.subdomain, args.admin_username, args.admin_password)
        elif args.command == "list-tenants":
            with owner_session() as s:
                for t in s.query(Tenant).order_by(Tenant.id):
                    print(f"{t.id}\t{t.subdomain}\t{t.status.name}\t{t.timezone}\t{t.name}")
        elif args.command == "set-status":
            with owner_session() as s:
                tenant = s.query(Tenant).filter(Tenant.subdomain == args.subdomain).first()
                if tenant is None:
                    sys.exit(f"[cli] 找不到健身房：{args.subdomain}")
                tenant.status = TenantStatus[args.status]
                s.commit()
                print(f"[cli] {args.subdomain} → {args.status}（各 API 程序最多 30 秒內生效）")
    except ValueError as exc:
        sys.exit(f"[cli] 錯誤：{exc}")


if __name__ == "__main__":
    main()

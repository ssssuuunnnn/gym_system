#!/bin/sh
set -e

echo "[entrypoint] running alembic migrations..."
alembic upgrade head

# 本機／單一健身房部署：自動開通 DEFAULT_TENANT（可重複執行）
if [ -n "$DEFAULT_TENANT" ]; then
  echo "[entrypoint] ensuring default tenant: $DEFAULT_TENANT"
  python -m app.cli create-tenant --subdomain "$DEFAULT_TENANT" --name "${DEFAULT_TENANT_NAME:-$DEFAULT_TENANT}"

  if [ -n "$ADMIN_USERNAME" ] && [ -n "$ADMIN_PASSWORD" ]; then
    echo "[entrypoint] seeding admin account..."
    python -m app.seed_admin
  fi
fi

# 平台管理員（平台管理後台 http://platform.<BASE_DOMAIN> 的登入帳號），可重複執行、不覆蓋密碼
if [ -n "$PLATFORM_ADMIN_USERNAME" ] && [ -n "$PLATFORM_ADMIN_PASSWORD" ]; then
  echo "[entrypoint] ensuring platform admin: $PLATFORM_ADMIN_USERNAME"
  python -m app.cli create-platform-admin --username "$PLATFORM_ADMIN_USERNAME" --password "$PLATFORM_ADMIN_PASSWORD"
fi

echo "[entrypoint] starting: $*"
exec "$@"

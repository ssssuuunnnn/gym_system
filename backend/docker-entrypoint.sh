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

echo "[entrypoint] starting: $*"
exec "$@"

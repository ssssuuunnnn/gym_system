#!/bin/sh
set -e

echo "[entrypoint] running alembic migrations..."
alembic upgrade head

if [ -n "$ADMIN_USERNAME" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "[entrypoint] seeding admin account..."
  python -m app.seed_admin
fi

echo "[entrypoint] starting: $*"
exec "$@"

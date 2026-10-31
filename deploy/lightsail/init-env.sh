#!/bin/sh
# 在主機上第一次部署時產生 /opt/gym-system/.env（已存在就不動）。密碼與金鑰都是隨機值，只存在主機上。
set -eu
cd "$(dirname "$0")/../.."
[ -f .env ] && exit 0

rand() { openssl rand -hex 24; }
platform_password=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)

sed \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(rand)|" \
  -e "s|^DB_OWNER_PASSWORD=.*|DB_OWNER_PASSWORD=$(rand)|" \
  -e "s|^DB_APP_PASSWORD=.*|DB_APP_PASSWORD=$(rand)|" \
  -e "s|^DB_PLATFORM_PASSWORD=.*|DB_PLATFORM_PASSWORD=$(rand)|" \
  -e "s|^SECRET_KEY=.*|SECRET_KEY=$(openssl rand -hex 32)|" \
  -e "s|^DATA_ENCRYPTION_KEY=.*|DATA_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr '+/' '-_')|" \
  -e "s|^PLATFORM_ADMIN_PASSWORD=.*|PLATFORM_ADMIN_PASSWORD=$platform_password|" \
  deploy/lightsail/env.example > .env
chmod 600 .env

echo "已產生 .env。平台管理後台帳號 ops／密碼 $platform_password（只顯示這一次，登入後請到「帳號」修改）"

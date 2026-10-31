#!/bin/sh
# 備援用：從本機把目前的 commit（HEAD）部署到 Lightsail 主機：上傳原始碼 → 首次產生 .env → 在主機上 build 並啟動。
# 平常由 GitHub Actions 自動部署（.github/workflows/deploy.yml，用 GHCR image），這支只在 Actions 不能用時使用。
# 用法：deploy/lightsail/deploy.sh [ubuntu@主機IP]（或設定 GYM_DEPLOY_HOST）；SSH 金鑰預設 ~/.ssh/gym-lightsail.pem。
set -eu
cd "$(dirname "$0")/../.."

HOST=${1:-${GYM_DEPLOY_HOST:?請提供 ubuntu@主機IP 或設定 GYM_DEPLOY_HOST}}
KEY=${GYM_DEPLOY_KEY:-$HOME/.ssh/gym-lightsail.pem}
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new $HOST"

if [ -n "$(git status --porcelain)" ]; then
  echo "提醒：有未 commit 的變更，只會部署 HEAD（$(git rev-parse --short HEAD)）"
fi

echo "==> 上傳 $(git rev-parse --short HEAD) 到 $HOST:/opt/gym-system"
git archive --format=tar HEAD | $SSH "tar -x -C /opt/gym-system"

$SSH "sh /opt/gym-system/deploy/lightsail/init-env.sh"

# 本機 deploy/lightsail/certs/ 有 Origin 憑證時一併上傳（該目錄不進 git，也不在 git archive 裡）
CERTS=deploy/lightsail/certs
if [ -f $CERTS/origin.pem ] && [ -f $CERTS/origin.key ]; then
  $SSH "mkdir -p /opt/gym-system/$CERTS && chmod 700 /opt/gym-system/$CERTS"
  scp -i "$KEY" -q $CERTS/origin.pem $CERTS/origin.key "$HOST:/opt/gym-system/$CERTS/"
  $SSH "chmod 644 /opt/gym-system/$CERTS/origin.pem && chmod 600 /opt/gym-system/$CERTS/origin.key"
fi

if ! $SSH "test -f /opt/gym-system/deploy/lightsail/certs/origin.pem && test -f /opt/gym-system/deploy/lightsail/certs/origin.key"; then
  echo "主機上還沒有 Cloudflare Origin 憑證：請放到 /opt/gym-system/deploy/lightsail/certs/origin.pem、origin.key（見 deploy/lightsail/README.md）"
  exit 1
fi

# 在主機上 build 的 image 標成 local-<sha>，避免和 GHCR 上同 sha 的 image 混淆；下次自動部署會改回 GHCR 版本
TAG=local-$(git rev-parse --short HEAD)
$SSH "cd /opt/gym-system && if grep -q '^IMAGE_TAG=' .env; then sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=$TAG|' .env; else printf '\\nIMAGE_TAG=$TAG\\n' >> .env; fi"

echo "==> build 並啟動（$TAG）"
$SSH "cd /opt/gym-system && docker compose -f docker-compose.prod.yml up -d --build --remove-orphans && docker image prune -f"
$SSH "cd /opt/gym-system && docker compose -f docker-compose.prod.yml ps"

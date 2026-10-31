#!/bin/sh
# 在主機上把服務更新到指定版本（GHCR 上的 image，標籤＝commit sha）。由 GitHub Actions 透過 SSH 呼叫，
# 也可以在主機上手動執行（例如退版）：sh deploy/lightsail/update.sh <commit sha>
# 呼叫前要先 docker login ghcr.io（workflow 會用該次工作的 GITHUB_TOKEN 登入、結束後登出）。
# 步驟：檢查 .env 與憑證 → 備份資料庫 → 寫入 IMAGE_TAG → pull → 重啟（啟動時自動 migration）→ 健康檢查。
set -eu
cd "$(dirname "$0")/../.."

TAG=${1:?用法：update.sh <image tag（commit sha）>}
COMPOSE="docker compose -f docker-compose.prod.yml"
BACKUP_DIR=backups
KEEP_BACKUPS=10

# 不在這裡產生 .env：init-env.sh 會印出平台管理員密碼，而 repo 公開、Actions 紀錄任何人都看得到
if [ ! -f .env ]; then
  echo "主機上還沒有 .env：請先用本機的 deploy/lightsail/deploy.sh 做首次部署" >&2
  exit 1
fi

if ! { [ -f deploy/lightsail/certs/origin.pem ] && [ -f deploy/lightsail/certs/origin.key ]; }; then
  echo "主機上還沒有 Cloudflare Origin 憑證（deploy/lightsail/certs/origin.pem、origin.key），見 deploy/lightsail/README.md" >&2
  exit 1
fi

# 部署前備份：新版本啟動時會跑 migration，出問題時才有比每日快照更新的資料可還原
mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
if [ -n "$($COMPOSE ps -q postgres 2>/dev/null)" ]; then
  file="$BACKUP_DIR/pre-deploy-$(date +%Y%m%d-%H%M%S)-$(echo "$TAG" | cut -c1-7).dump"
  echo "==> 備份資料庫到 $file"
  db_name=$(sed -n 's/^DB_NAME=//p' .env)
  $COMPOSE exec -T postgres pg_dump -U postgres -Fc "${db_name:-fitness_studio}" > "$file"
  # 只保留最新的 $KEEP_BACKUPS 份
  ls -1t "$BACKUP_DIR"/pre-deploy-*.dump 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
fi

previous=$(sed -n 's/^IMAGE_TAG=//p' .env)
if grep -q '^IMAGE_TAG=' .env; then
  sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=$TAG|" .env
else
  printf '\n# 目前部署的版本（commit sha），由 update.sh 寫入\nIMAGE_TAG=%s\n' "$TAG" >> .env
fi
echo "==> 版本 ${previous:-（無）} → $TAG"
echo "$(date -u +%FT%TZ) $TAG" >> "$BACKUP_DIR/deploy-history.log"

$COMPOSE pull backend frontend
$COMPOSE up -d --no-build --remove-orphans

echo "==> 健康檢查（等待 migration 與啟動，最多 120 秒）"
i=0
until $COMPOSE exec -T backend curl -fs -o /dev/null http://127.0.0.1:8000/health 2>/dev/null \
  && curl -fsk -o /dev/null https://127.0.0.1/login; do
  i=$((i + 5))
  if [ "$i" -ge 120 ]; then
    echo "健康檢查失敗。查看紀錄：$COMPOSE logs --tail 100 backend" >&2
    [ -n "$previous" ] && echo "退版：sh deploy/lightsail/update.sh $previous（若新版 migration 已改資料表，可能要先還原 $BACKUP_DIR 裡的備份）" >&2
    $COMPOSE ps >&2
    exit 1
  fi
  sleep 5
done

docker image prune -f >/dev/null
$COMPOSE ps
echo "==> 部署完成：$TAG"

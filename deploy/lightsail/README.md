# 試營運部署：AWS Lightsail ＋ Cloudflare

最省錢的單機部署：一台 Lightsail 主機跑 `docker-compose.prod.yml`（PostgreSQL、後端、nginx 全在同一台），網域 DNS 與對外 HTTPS 由 Cloudflare 處理。用量變大後再換 ECS＋RDS。

```
使用者 ─HTTPS─► Cloudflare Proxy（*.sunkuo.cc 免費憑證）
                   │ HTTPS（Origin Certificate，SSL 模式 Full (strict)）
                   ▼
        Lightsail gym-system（ap-southeast-2，固定 IP gym-system-ip）
        nginx :443 ─ backend ─ postgres（docker compose）
```

| 項目 | 設定 |
|---|---|
| 主機 | Lightsail `gym-system`，Ubuntu 24.04，`small_3_2`（2 GB／2 vCPU／60 GB，約 US$12／月），2 GB swap |
| 固定 IP | `gym-system-ip` |
| 防火牆 | 443 只開放 [Cloudflare IP](https://www.cloudflare.com/ips-v4)；22 只開放管理者 IP ＋ Lightsail 瀏覽器 SSH |
| 備份 | Lightsail 每日自動快照（UTC 18:00＝台灣 02:00，保留 7 份） |
| SSH | `ssh -i ~/.ssh/gym-lightsail.pem ubuntu@<固定 IP>`（金鑰對 `gym-system-key`） |
| 網址 | 健身房 `https://<子網域>.sunkuo.cc`，平台管理後台 `https://platform.sunkuo.cc`；主網域本身不是健身房 |

## 檔案

- `docker-compose.prod.yml`（repo 根目錄）：密碼／金鑰都從主機的 `/opt/gym-system/.env` 讀取，只對外開 443，不部署 adminer。
- `nginx.conf`：取代 `frontend/nginx.conf` 的 server 設定（443 ＋ Origin 憑證 ＋ Cloudflare 真實 IP），路由規則與本機共用 `frontend/nginx/routes.conf`。
- `setup-server.sh`：主機首次開機的初始化（Docker、swap、`/opt/gym-system`）。Lightsail 會把它接在自己的 `/bin/sh` 腳本後執行，只能寫 POSIX sh。
- `init-env.sh`：第一次部署時用隨機值產生 `.env`，並顯示一次平台管理員密碼。
- `deploy.sh`：從本機部署目前的 commit。

## Cloudflare 設定（一次）

1. **DNS**：新增 `A` 紀錄，名稱 `*`，內容＝固定 IP，Proxy 狀態＝已代理（橘色雲）。已存在的其他紀錄（例如 `www`）優先於萬用紀錄，不受影響。
2. **SSL/TLS → 概觀**：加密模式選 **Full (strict)**。
3. **SSL/TLS → 原始伺服器 → 建立憑證**：RSA、主機名稱 `*.sunkuo.cc` 與 `sunkuo.cc`、有效期 15 年。把「原始憑證」存成 `deploy/lightsail/certs/origin.pem`、「私密金鑰」存成 `deploy/lightsail/certs/origin.key`（此目錄在 `.gitignore`，`deploy.sh` 會上傳到主機）。
4. **SSL/TLS → 邊緣憑證**：開啟「一律使用 HTTPS」。

## 部署

```bash
deploy/lightsail/deploy.sh ubuntu@<固定 IP>   # 或 export GYM_DEPLOY_HOST=ubuntu@<固定 IP>
```

第一次部署會產生 `.env` 並印出平台管理員 `ops` 的密碼（只顯示一次）。之後到 `https://platform.sunkuo.cc` 登入、改密碼、開通健身房。後續更新：commit 後再跑一次 `deploy.sh`（啟動時自動跑 migration）。

## 維運

```bash
ssh -i ~/.ssh/gym-lightsail.pem ubuntu@<固定 IP>
cd /opt/gym-system
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
# 手動備份資料庫
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres -Fc fitness_studio > backup-$(date +%F).dump
# 平台 CLI（owner 連線）
docker compose -f docker-compose.prod.yml exec backend python -m app.cli list-tenants
```

- 修改 LINE 等設定：編輯主機上的 `/opt/gym-system/.env`，再 `docker compose -f docker-compose.prod.yml up -d`。**不要換 `DATA_ENCRYPTION_KEY`**（健身房的 LINE 官方帳號金鑰會解不開）。
- 管理者 IP 變了連不上 SSH：到 Lightsail 主控台用瀏覽器 SSH，或用 `aws lightsail open-instance-public-ports` 加入新 IP。
- 還原：Lightsail 主控台 → 快照 → 從快照建立新主機，再把固定 IP 改掛到新主機。

## 已知限制

- 單機、單一可用區，沒有自動備援；主機故障時從快照還原（最多遺失約一天的資料）。
- 體驗課詢問的頻率限制取 `X-Forwarded-For` 第一段，訪客可自行偽造；試營運可接受。
- AWS Free plan 到期（或抵用金用完）前要在 AWS Settings 升級為付費方案，服務才不會暫停。

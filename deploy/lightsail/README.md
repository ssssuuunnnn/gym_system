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
- `update.sh`：在主機上更新到指定版本（GHCR image）：部署前備份資料庫 → 寫入 `IMAGE_TAG` → pull → 重啟 → 健康檢查。由 GitHub Actions 呼叫，也可手動退版。
- `deploy.sh`：備援用，從本機上傳原始碼並在主機上 build（GitHub Actions 不能用時）。
- `.github/workflows/deploy.yml`：自動部署，見下方「自動部署」。

## Cloudflare 設定（一次）

1. **DNS**：新增 `A` 紀錄，名稱 `*`，內容＝固定 IP，Proxy 狀態＝已代理（橘色雲）。已存在的其他紀錄（例如 `www`）優先於萬用紀錄，不受影響。
2. **SSL/TLS → 概觀**：加密模式選 **Full (strict)**。
3. **SSL/TLS → 原始伺服器 → 建立憑證**：RSA、主機名稱 `*.sunkuo.cc` 與 `sunkuo.cc`、有效期 15 年。把「原始憑證」存成 `deploy/lightsail/certs/origin.pem`、「私密金鑰」存成 `deploy/lightsail/certs/origin.key`（此目錄在 `.gitignore`，`deploy.sh` 會上傳到主機）。
4. **SSL/TLS → 邊緣憑證**：開啟「一律使用 HTTPS」。

## 自動部署（GitHub Actions ＋ GHCR ＋ Tailscale）

```
push main → CI（alembic-check、pytest）通過
          → Deploy：打包 backend／frontend image → ghcr.io/ssssuuunnnn/gym-{backend,frontend}:<commit sha>
          → 經 Tailscale SSH 進主機 → update.sh <sha>（備份 DB → pull → 重啟＋migration → 健康檢查）
          → 從外部確認 https://platform.sunkuo.cc/login
```

- 主機上要已經有 `.env`（首次部署用下方的 `deploy.sh`）。repo 是公開的，Actions 紀錄也公開，所以 workflow 不輸出任何機密。
- 主機不再 build，也不放原始碼的其他部分；只收 `docker-compose.prod.yml`、`deploy/lightsail/`、`docker/postgres/`。`.env` 與 Origin 憑證只在主機上，不放 GitHub。
- SSH 22 埠不必對 GitHub 開放：runner 透過 Tailscale（出站連線）連進主機，Lightsail 防火牆維持原樣。
- 拉 image 用該次工作的 `GITHUB_TOKEN`（部署完就 `docker logout`），主機上不存長期 token。
- 每次部署前把資料庫備份到主機的 `/opt/gym-system/backups/pre-deploy-*.dump`（保留最新 10 份），部署紀錄在 `backups/deploy-history.log`。

### 一次性設定

1. **Tailscale 管理後台 → Access controls**，加入標籤與規則（只讓 CI 連主機的 22 埠）：
   ```json
   "tagOwners": { "tag:ci": ["autogroup:admin"], "tag:server": ["autogroup:admin"] },
   "grants": [ { "src": ["tag:ci"], "dst": ["tag:server"], "ip": ["tcp:22"] } ]
   ```
   （若 policy 還有預設的「全部互通」規則，記得移除或收窄，否則 CI 也能連到你其他裝置。）
2. **Tailscale → Settings → OAuth clients**：建立 client，權限 `Auth Keys: Write`、標籤 `tag:ci`，記下 Client ID／Secret。
3. **主機加入 tailnet**（SSH 進主機）：
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up --advertise-tags=tag:server --hostname=gym-system
   ```
   在 Tailscale 後台 Machines 找到 `gym-system`，**Disable key expiry**（否則半年後會斷線）。
4. **部署專用 SSH 金鑰**（在本機，不要重用 `gym-lightsail.pem`）：
   ```bash
   ssh-keygen -t ed25519 -N '' -C github-deploy -f ~/.ssh/gym-github-deploy
   ssh -i ~/.ssh/gym-lightsail.pem ubuntu@<固定 IP> 'cat >> ~/.ssh/authorized_keys' < ~/.ssh/gym-github-deploy.pub
   ssh-keyscan -t ed25519 <固定 IP> | sed 's/^[^ ]*/gym-system/'   # 主機公鑰，輸出整行當 DEPLOY_KNOWN_HOSTS
   ```
5. **GitHub repo → Settings → Environments → New environment `production`**：Deployment branches 限 `main`（想每次手動核准可加 Required reviewers），並加入 Environment secrets：

   | Secret | 內容 |
   |---|---|
   | `TS_OAUTH_CLIENT_ID` / `TS_OAUTH_SECRET` | 步驟 2 |
   | `DEPLOY_HOST` | `gym-system`（tailnet 的 MagicDNS 名稱） |
   | `DEPLOY_SSH_KEY` | `~/.ssh/gym-github-deploy` 私鑰全文 |
   | `DEPLOY_KNOWN_HOSTS` | 步驟 4 `ssh-keyscan` 的輸出 |

6. 第一次跑完後，GHCR 的 `gym-backend`／`gym-frontend` package 預設是私有的，維持即可（部署用 `GITHUB_TOKEN` 拉取）。

### 日常

- 合併到 `main` → 自動部署。進度在 GitHub → Actions → Deploy。
- **退版**：Actions → Deploy → Run workflow，`tag` 填舊版本的完整 commit sha（不重新打包，直接部署 GHCR 上的舊 image）；或在主機上 `sh deploy/lightsail/update.sh <sha>`（需先 `docker login ghcr.io`）。若新版的 migration 已改了資料表，退版前可能要先用 `backups/` 的備份還原：
  ```bash
  docker compose -f docker-compose.prod.yml exec -T postgres pg_restore -U postgres -d fitness_studio --clean --if-exists < backups/pre-deploy-<…>.dump
  ```

## 首次部署／手動部署（備援）

```bash
deploy/lightsail/deploy.sh ubuntu@<固定 IP>   # 或 export GYM_DEPLOY_HOST=ubuntu@<固定 IP>
```

第一次部署會產生 `.env` 並印出平台管理員 `ops` 的密碼（只顯示一次）。**首次部署一定要用這支腳本**：自動部署不會產生 `.env`，因為 repo 公開、Actions 紀錄任何人都看得到。之後到 `https://platform.sunkuo.cc` 登入、改密碼、開通健身房。這支腳本在主機上 build（image 標 `local-<sha>`），只在 GitHub Actions 不能用時使用。

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

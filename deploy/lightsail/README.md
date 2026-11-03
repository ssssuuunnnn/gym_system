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
- `deploy.sh`：從本機部署目前的 commit（GitHub Actions 的自動部署也是跑這支）。主機上的程式碼會和該 commit 完全一致：先解到 `/opt/gym-system/.release`，再用 `rsync --delete` 同步，已刪除或改名的舊檔會清掉；最上層原本就有的檔案與資料夾（`.env` 等）和 `deploy/lightsail/certs/` 不會動。主機沒有 rsync 時會自動安裝。
- `.github/workflows/deploy.yml`：main 的 CI 通過後自動部署，見下方「自動部署」。

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

## 自動部署（GitHub Actions）

`.github/workflows/deploy.yml`：main 的 CI 全部通過後，自動把那個 commit 部署到主機；也可以在 GitHub → Actions → Deploy → Run workflow 手動執行。

流程：用部署專用 IAM 使用者的 access key（只能讀／改這台主機的防火牆）→ 讀出 Lightsail 防火牆規則，暫時把 22 埠開給這次的 runner IP → 執行 `deploy.sh` → 不論成敗都把防火牆原樣還原 → 確認 `https://platform.sunkuo.cc/robots.txt` 有回應。

### 一次性設定

**1. 部署專用的 SSH 金鑰**（不要用你自己的 `gym-lightsail.pem`，之後要停用自動部署時，刪掉這把就好）

```bash
ssh-keygen -t ed25519 -N "" -C github-deploy -f ~/.ssh/gym-github-deploy
# 把公鑰加到主機
cat ~/.ssh/gym-github-deploy.pub | ssh -i ~/.ssh/gym-lightsail.pem ubuntu@<固定 IP> 'cat >> ~/.ssh/authorized_keys'
# 主機指紋（給 DEPLOY_KNOWN_HOSTS 用）
ssh-keyscan -t ed25519 <固定 IP>
```

**2. AWS：部署專用的 IAM 使用者，只能改這台主機的防火牆**（用你自己的 AWS 帳號登入後，在 CloudShell 或本機執行）

> 這個 AWS 項目的受管 SCP 禁止所有 `iam:*Provider*` 動作，**無法用 GitHub OIDC**，所以改用 IAM 使用者的 access key（存在 GitHub 的 production 環境）。

```bash
aws iam create-user --user-name gym-system-github-deploy

# GetInstancePortStates 檢查的是區域層級 ARN（不是個別主機），所以範圍是「這個帳號＋區域的 Lightsail」
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
cat > policy.json <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["lightsail:GetInstancePortStates", "lightsail:PutInstancePublicPorts"],
    "Resource": "arn:aws:lightsail:ap-southeast-2:$ACCOUNT:*"
  }]
}
JSON
aws iam put-user-policy --user-name gym-system-github-deploy --policy-name lightsail-firewall --policy-document file://policy.json

# 產生金鑰並直接寫進 GitHub（不在畫面上顯示）
K=$(aws iam create-access-key --user-name gym-system-github-deploy --output json)
echo "$K" | jq -r .AccessKey.AccessKeyId     | gh secret set AWS_ACCESS_KEY_ID --env production
echo "$K" | jq -r .AccessKey.SecretAccessKey | gh secret set AWS_SECRET_ACCESS_KEY --env production
unset K
```

**輪替金鑰**：再跑一次最後三行產生新金鑰，確認部署成功後 `aws iam list-access-keys --user-name gym-system-github-deploy` 找出舊的，`aws iam delete-access-key --user-name gym-system-github-deploy --access-key-id <舊 ID>`。

**3. GitHub：Settings → Environments → New environment，名稱 `production`**，在裡面新增：

| 種類 | 名稱 | 值 |
|---|---|---|
| Secret | `DEPLOY_HOST` | `ubuntu@<固定 IP>` |
| Secret | `DEPLOY_SSH_KEY` | `~/.ssh/gym-github-deploy` 的完整內容（含 BEGIN／END 兩行） |
| Secret | `DEPLOY_KNOWN_HOSTS` | 步驟 1 `ssh-keyscan` 印出的那一行（建議設定；沒設定就第一次連線時直接接受） |
| Secret | `AWS_ACCESS_KEY_ID`／`AWS_SECRET_ACCESS_KEY` | 步驟 2 寫入 |

選用的 Variable：`LIGHTSAIL_INSTANCE`（預設 `gym-system`）、`AWS_REGION`（預設 `ap-southeast-2`）、`HEALTHCHECK_URL`（預設 `https://platform.sunkuo.cc/robots.txt`）。

想要部署前先人工按「核准」：在 `production` 環境勾 **Required reviewers** 並加上自己。

**4. 測試**：Actions → Deploy → Run workflow。之後每次 PR 合併進 main，CI 通過就會自動部署。

### 注意

- 自動部署只會部署 git 裡的東西；`.env` 與 Origin 憑證仍然只在主機上（第一次部署請先用本機的 `deploy.sh`）。
- 部署中斷時，「還原防火牆」步驟仍會執行；萬一還是沒還原（例如 GitHub 整個掛掉），到 Lightsail 主控台把 22 埠多出來的 IP 刪掉即可。
- 要停用：Actions → Deploy → `...` → Disable workflow，或刪掉主機 `~/.ssh/authorized_keys` 裡 `github-deploy` 那一行，並刪除 IAM 使用者 `gym-system-github-deploy` 的 access key。

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

# ADR 0005：健身房自己的 LINE 官方帳號（會員入口）

- **狀態**：已採納（第一、二階段）
- **日期**：2026-10-25
- **決策者**：Sunkuo
- **前提**：[ADR 0001 多租戶](0001-multi-tenancy.md)、[ADR 0004 LINE 通知店家](0004-line-notifications.md)

## 背景

台灣的健身房多半已經有自己的 LINE 官方帳號，會員也習慣在 LINE 裡跟店家聯絡。希望會員加入官方帳號後，直接在 LINE 裡加入會員、查預約、預約課程、購買方案，不用另外記網址和帳號密碼。

ADR 0004 的「LINE 通知店家」用的是**平台共用**的官方帳號，對象是老闆與員工；這份 ADR 的對象是**會員**，用的是**健身房自己的**官方帳號。

## 決策

### 1. 方案 A：健身房在自己的 Provider 底下建立 LINE 登入與 LIFF

LINE 給同一個人的使用者 ID 依「服務提供者（Provider）」而不同。官方帳號要回覆或推播給會員，用的是官方帳號那個 Provider 的 ID，所以 LINE 登入 channel 與 LIFF 必須建在**同一個 Provider**。

| 選項 | 結論 |
|---|---|
| **A. 健身房在自己的 Provider 建 LINE 登入 channel＋LIFF，把金鑰與 ID 填到系統** | **採用**：ID 只有一種，綁定、回覆、之後的推播都直接可用；訊息費用算在健身房自己的方案 |
| B. 平台共用一個 LIFF，健身房只在選單放連結 | 不採用：LIFF 拿到的是平台 Provider 的 ID，和健身房官方帳號的對不上，之後推播還要再做一次帳號連結 |

LINE 官方建議新的 LIFF 改建成 LINE MINI App，並預告 LIFF 會整併進 LINE MINI App；目前仍可在 LINE 登入 channel 新增 LIFF，系統只需要 LIFF ID 與登入 channel ID，之後換成 MINI App 時填入對應的值即可。

### 2. 設定：三步精靈＋「檢查連線」

系統設定 › LINE 官方帳號：

1. **Messaging API**：Channel secret、Channel access token（long-lived）
2. **LINE 登入與 LIFF**：在同一個 Provider 建 LINE Login channel（Published），LIFF 的 Endpoint URL 為 `https://<子網域>.<主網域>/liff`、Size Full、Scopes `openid` `profile`、Add friend option `On (Aggressive)`；填入登入 Channel ID 與 LIFF ID（LIFF ID 開頭必須是該 Channel ID，存檔時先檢查）
3. **儲存並檢查連線**（`POST /line-oa/verify`）：
   - 讀官方帳號資料（`/v2/bot/info`）→ 確認 access token（**必要**）
   - LIFF ID 與登入 channel 對得上（**必要**）
   - 設定 Webhook 為 `https://<子網域>.<主網域>/api/v1/line-oa/webhook` 並請 LINE 測試，順便確認 Channel secret（只提示：本機沒有 https）
   - 建立底部選單（預約課程・我的預約・購買方案・會員中心，圖在 `app/static/line/rich_menu.png`），設為預設後刪掉舊的（只提示）

必要項目都通過才啟用；改了任何設定都要重新檢查。可隨時停用（已綁定的會員保留）。

### 3. 金鑰加密保存

Channel secret 與 access token 以 Fernet 加密存在 `line_oa_channels`（`core/crypto.py`），金鑰為環境變數 `DATA_ENCRYPTION_KEY`，留空時由 `SECRET_KEY` 衍生。API 只回傳末四碼，前端不會再拿到原值。**正式環境應設定 `DATA_ENCRYPTION_KEY`**：之後若更換 `SECRET_KEY`，已存的金鑰會解不開，要重新輸入。

### 4. 會員登入、加入與綁定

```
底部選單 → https://liff.line.me/<LIFF ID>/book → /liff/book（LIFF SDK 登入）
  → POST /auth/line {id_token}
     後端向 LINE 驗證 ID token，client_id＝這家健身房的登入 Channel ID（別家的登入不能用）
     ├─ 已綁定 → 一般登入 token → 會員前台 /member/book
     └─ 未綁定 → link_token（15 分鐘、scope=line_link、只帶 LINE ID 與健身房）
          ├─ 加入會員 POST /auth/line/join {姓名, 手機, 同意個資告知}
          └─ 我已經是會員 POST /auth/line/link {帳號, 密碼}
```

- **加入會員**：帳號自動產生（`line-xxxxxx`），**沒有密碼**（`password_hash` 以 `!` 開頭，任何密碼都驗證失敗）。要用網頁登入時，由管理員在會員詳情「設定新密碼」。
- **綁定既有帳號**：必須輸入正確的帳號密碼；管理員帳號不能綁定；一個帳號只能綁一個 LINE、一個 LINE 在同一家只能綁一個會員（`uq_users_tenant_line_user`）。
- **解除綁定**：管理員在會員詳情可隨時解除；會員自己只有在有密碼時才能解除（否則會無法登入）。
- 會員前台不需要改：在 LINE 裡（`inLine`）隱藏登出與修改密碼；登入逾時自動回到 `/liff` 重新登入。
- 本機開發沒有 LINE：開發模式可在 localStorage 設 `liffMockIdToken` 略過 LIFF SDK（正式版不讀）。

### 5. Webhook 只做最少的回覆

`POST /api/v1/line-oa/webhook`（健身房網址，依網址判斷是哪一家，再用該家的 Channel secret 驗證簽章）：

- 加好友 → 歡迎訊息＋「加入會員／登入」按鈕
- 傳「會員／會員中心／預約／我的預約／購買」→ 打開對應頁面的按鈕
- 其他訊息不回覆，留給店家在官方帳號後台的聊天功能回覆

只用回覆（reply，免費），不推播。未啟用時簽章正確仍回 200（LINE 驗證 Webhook 用）。

### 6. 付款維持「轉帳＋後台確認」

會員在 LINE 裡購買仍是「待付款」，由管理員在購買紀錄確認收款。系統設定新增「付款方式說明」（`system_settings.payment_instructions`），顯示在會員的「我的方案與訂單」待付款提示裡。

## 資料表

| 表／欄位 | 說明 |
|---|---|
| `line_oa_channels`（租戶，RLS，每家一筆） | 加密的 secret／token、登入 Channel ID、LIFF ID、是否啟用、官方帳號名稱與 Basic ID、底部選單 ID、最後檢查時間與問題 |
| `users.display_name`、`phone` | 會員姓名、手機（LINE 加入時填寫，管理員可修改；只有管理員看得到） |
| `users.line_user_id`、`line_display_name`、`line_linked_at` | LINE 綁定 |
| `system_settings.payment_instructions` | 付款方式說明 |

### 7. 第二階段：從健身房官方帳號通知會員

| 事件 | 何時發 | 按鈕 |
|---|---|---|
| 預約成功／櫃台已為你預約 | 管理員核准，或櫃台直接幫會員建立預約 | 查看我的預約 |
| 預約未成立 | 管理員拒絕（寫明堂數已退回） | 重新預約 |
| 預約已取消 | **櫃台**取消會員的預約（寫明是否退回堂數） | 查看我的預約 |
| 已收到款項 | 管理員確認收款（方案、金額、入帳堂數） | 課程方案：去預約課程（會員為某堂課購買時直接回到那堂）；商品：查看我的訂單 |
| 明天的課程提醒 | 前一天設定的整點起 2 小時內（健身房當地時間，預設 20:00），同一位會員明天的課合成一則 | 查看我的預約 |

- **會員自己的操作不發**（自己送出、自己取消、自己下單），畫面上已經看得到結果。
- 只發給已綁定 LINE、沒有關閉通知的會員：會員在「我的」可以關閉（`users.line_notify`）。
- 健身房在「LINE 官方帳號 › 會員通知」逐項開關、選提醒時間（前一天 06–22 點）、設每月上限（留空＝不限制）。
- 費用算在健身房自己的 LINE 方案：卡片顯示系統本月推播數，以及向 LINE 查到的方案額度與用量（`/v2/bot/message/quota`）。
- 發送：`line_member_messages`（租戶表，RLS）。和事件同一個交易寫入、回應後用 push 送出；背景工作每分鐘產生上課提醒並處理重試。暫時錯誤在 1、5、30 分鐘後重試；LINE 方案額度用完（429 monthly limit）直接記為失敗，不重試。送完清掉訊息內容；`dedupe_key`（例如 `reminder:<會員>:<日期>`）避免重複。
- 提醒只在設定時段內產生：太晚才確認的預約已經收到「預約成功」，不再半夜提醒。
- 平台看不到這些訊息（和 ADR 0004 的店家通知分開計算，不占平台的每月上限）。

## 之後

- 第三階段：線上付款、會員卡 QR 碼簽到、店家通知改走自家官方帳號、平台代為設定。

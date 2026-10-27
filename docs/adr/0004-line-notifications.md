# ADR 0004：LINE 通知店家

- **狀態**：已採納
- **日期**：2026-10-25
- **決策者**：Sunkuo
- **前提**：[ADR 0001 多租戶](0001-multi-tenancy.md)、[ADR 0002 平台管理後台](0002-platform-console.md)、[ADR 0003 形象網站](0003-gym-website.md)

## 背景

老闆和員工多半不會一直開著後台。有新的體驗課詢問、會員下單待收款、會員送出預約時，希望馬上在 LINE 收到通知，避免漏接客人。

LINE Notify 已於 2025-03-31 停止服務，現在只能用 **LINE 官方帳號＋Messaging API**。主動推播（push／multicast）依方案計費，回覆（reply）免費。台灣 2026-11-01 起的方案：輕用量免費 200 則／月、中用量 NT$1,000／3,000 則、高用量 NT$1,400／6,000 則，超過每則約 NT$0.2。

## 決策

### 1. 平台共用一個 LINE 官方帳號（選項 A）

| 選項 | 結論 |
|---|---|
| **A. 平台共用一個官方帳號** | **採用**：健身房不用申請、不用碰金鑰，掃 QR 碼即可；費用由平台統一控管 |
| B. 每家健身房自備官方帳號 | 之後再做：要各家申請 Messaging API、填入金鑰並自行付費，設定門檻高 |
| C. Email | 不採用：老闆不常看信，時效差 |

金鑰只放環境變數（`LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_BOT_BASIC_ID`），不進資料庫、不在畫面顯示。三個都沒設定時整個功能停用：不發送、後台顯示提示。

### 2. 綁定：一次性 6 位數綁定碼

1. 管理員在「系統設定 › LINE 通知」按「新增接收人」，畫面顯示加好友 QR 碼與綁定碼（10 分鐘、只能用一次）。
2. 接收人加通知帳號為好友，在對話傳送綁定碼。
3. Webhook（`POST /api/v1/line/webhook`，**只在平台網址**，驗證 `x-line-signature` HMAC-SHA256）找到對應的健身房，建立接收人並回覆確認（回覆不計費）。
4. 後台每 3 秒查詢一次綁定狀態，顯示「綁定成功」。

- 資料庫只存綁定碼的雜湊（`sha256(SECRET_KEY:line-bind:code)`）。
- Webhook 不知道是哪家健身房，所以由 `SECURITY DEFINER` 函式 `line_consume_bind_code` 跨租戶比對；**剛好一筆**有效綁定碼相符才綁定（極少數撞號時請對方重新產生），平台角色看不到其他欄位。
- 輸入錯誤以 LINE 使用者計：10 分鐘內 5 次即暫停（平台表 `line_bind_attempts`）。
- 對方封鎖通知帳號（unfollow）時，`line_deactivate_user` 停用所有健身房的該接收人。

### 3. 發送：寫入待發送表，回應後送出

- 事件發生時在**同一交易**寫入 `line_notifications`（收件人 id、訊息），回應後由 `BackgroundTasks` 送出；另有背景執行緒每 `LINE_DISPATCH_INTERVAL_SECONDS`（60 秒）處理到期的重試。多個程序同時處理時以 `FOR UPDATE SKIP LOCKED` 避免重送。
- 用 multicast（每次最多 500 人）。LINE 無回應、429、5xx 視為暫時失敗，於 1、5、30 分鐘後重試；其他錯誤或重試用完即失敗。
- 每家健身房每月上限 `tenants.line_monthly_cap`（預設 300 則，平台後台可改並寫操作紀錄），以健身房時區的月初起算；會超過的通知不發送（記為超過上限）。
- 送完（成功、失敗或略過）即清除收件人與訊息內容，只留事件、則數、結果與說明。

### 4. 內容最少化

通知是 Flex 卡片：健身房名稱、事件標題、2–3 行重點、一個進後台的按鈕。**不含手機號碼與 Email**，姓名只寫姓氏（王先生／小姐）。完整資料要登入後台。

### 5. 平台後台只看彙總

平台 › LINE 通知：本月全平台已發送對照方案額度（`LINE_PLAN_MONTHLY_QUOTA`）、各健身房用量與上限、發送紀錄（可篩選失敗／重試中／超過上限）。透過 `SECURITY DEFINER` 函式 `platform_line_usage`、`platform_line_log` 取得，看不到收件人與訊息內容。

## 資料表

| 表 | 層級 | 說明 |
|---|---|---|
| `line_recipients` | 健身房（RLS） | LINE user id、顯示名稱、三個事件開關、啟用狀態、綁定者 |
| `line_bind_codes` | 健身房（RLS） | 綁定碼雜湊、到期時間、使用時間 |
| `line_notifications` | 健身房（RLS） | 待發送／重試中／成功／失敗／超過上限／未設定 LINE |
| `line_bind_attempts` | 平台 | 綁定嘗試（限制錯誤次數） |

平台角色可讀寫 `line_recipients`（綁定時在 `act_as_tenant` 下建立）、讀寫 `line_bind_attempts`；應用程式角色不能執行上述函式。

## 結果

- 健身房管理員：系統設定多一張「LINE 通知」卡片（用量、接收人與事件勾選、測試通知、移除、綁定視窗）。
- 平台：多一個「LINE 通知」頁面；在 LINE Developers 設定 Webhook 為 `https://platform.<BASE_DOMAIN>/api/v1/line/webhook`，並關閉官方帳號的自動回應訊息。
- 費用：全平台總量受各家上限加總限制；平台方案額度不足時要升級方案或調低上限。
- 之後：選項 B（健身房自備帳號）、通知會員（預約提醒）、Email 通知。

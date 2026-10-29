# ADR 0009：後台鈴鐺通知

- **狀態**：已採納
- **日期**：2026-10-29
- **決策者**：Sunkuo
- **前提**：[ADR 0004 LINE 店家通知](0004-line-notifications.md)、[ADR 0008 後台帳號與權限](0008-staff-permissions.md)

## 背景

會員在前台預約、取消、下單，或訪客在形象網站留下體驗詢問時，後台人員要能馬上知道。LINE 店家通知（ADR 0004）適合不在電腦前的時候；坐在後台前的人需要畫面上的提醒與一份可回頭查看的清單。

## 決策

### 1. 四種事件，照功能權限決定收件人

| 事件 | 需要的功能 | 點了前往 |
|---|---|---|
| 會員送出預約（待確認） | 預約審核 | `/admin/reservations?highlight=<預約>` |
| 會員自己取消預約 | 預約審核 | 同上 |
| 會員下單，待付款 | 購買紀錄 | `/admin/purchases?highlight=<訂單>` |
| 網站體驗詢問 | 詢問名單 | `/admin/inquiries?highlight=<詢問>`（直接打開） |

觸發點和 LINE 店家通知相同，只有會員自己做的事才通知。收件人＝當下有該功能、未停用的後台帳號（排除做這件事的人）。讀取時再依目前權限過濾一次。

### 2. 每位收件人一筆

`staff_notifications`（tenant／RLS）：`user_id`、`kind`、`title`、`body`、`link`、`read_at`、`created_at`。和事件同一筆交易寫入，事件失敗就不會留下通知。每人一筆讓未讀數、已讀、全部已讀都只看自己的資料；量不大（每天幾十筆 × 幾位人員），超過 90 天自動刪除。內容只有姓名與摘要，不放電話（R41）。

### 3. 前端每 20 秒輪詢

`GET /notifications/summary?after_id=` 回未讀數、最新 id，以及 `after_id` 之後的新通知。前端記住看過的最新 id：剛打開後台只更新鈴鐺數字不跳 toast；之後的新通知在右上角跳 toast（6 秒、無聲音），點 toast 一樣換頁。多個分頁用瀏覽器儲存記住已跳過的最新 id，只跳一次。

不採用 WebSocket／SSE：要處理長連線、Cloudflare、多台後端，20 秒延遲對審核預約已足夠。日後需要秒級再改成推送，API 形狀可沿用。

### 4. 鈴鐺與列表頁

鈴鐺在後台 Header 登出左邊（`components/notifications/NotificationBell.tsx`），點開是全部／未讀切換、全部標為已讀、往下載入更早通知。列表頁用 `lib/useHighlightRow.ts` 依 `?highlight=` 跳到那一筆所在的分頁並加底色。

## 後果

- 新增一張表與 4 支 API（`/notifications`、`/summary`、`/{id}/read`、`/read-all`）。
- 每位登入中的後台人員每 20 秒一個很輕的查詢（索引 `(user_id, id)`）。
- 第二期可做：個人通知設定（只收某幾種）、瀏覽器桌面通知、改為伺服器推送。

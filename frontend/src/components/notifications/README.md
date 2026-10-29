# notifications/ — 後台鈴鐺通知（ADR 0009）

- `NotificationBell` — 後台 Header 右上角的鈴鐺：每 20 秒輪詢 `/notifications/summary`，未讀數 `Badge`，新通知跳 toast（6 秒、無聲音，多分頁只跳一次），點開 `Popover` 顯示 `NotificationPanel`。由 `AppLayout` 放進 `BackOfficeShell` 的 `headerExtra`。
- `NotificationPanel` — 全部／未讀 `Segmented`、全部標為已讀、通知列表（`useInfiniteQuery`，往下載入更早的）。
- `NotificationKindIcon` — 通知種類的圓形圖示（列表與 toast 共用）。
- `useOpenNotification` — 點通知（列表或 toast）：讓對應頁面重新讀資料、換頁、標已讀。
- 目標頁面用 `lib/useHighlightRow.ts` 依網址 `?highlight=<id>` 跳到那一頁並標出那一列。

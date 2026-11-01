# 試用（ADR 0013）

店家網址上和「平台自助申請試用」有關的元件。試用狀態從公開的 `GET /tenant/profile` 的 `trial` 讀（`['tenant-profile']` 快取，與 `useTerms` 共用）。

- `TrialGate` — 包在店家的 router 外面（`App.tsx`）。試用到期就整頁換成「試用已到期，請聯絡我們」；`api/client.ts` 收到 403「試用已到期」會發 `TRIAL_EXPIRED_EVENT`，這裡收到就重新讀取。
- `TrialHeaderTag` — 後台頁首的「試用剩 N 天」，最後 7 天變警示色，點開看到期日與聯絡方式。
- `TrialContactList` — 平台的 LINE／電話／Email（只有平台設定為顯示的欄位）。
- `SampleDataAlert` — 儀表板的「目前有開通時建立的範例資料」＋清除按鈕（`POST /system-settings/clear-sample-data`，需要系統設定權限）。

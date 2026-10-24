# 前台元件（會員／教練）

會員與教練使用的前台版面與共用元件。設計稿：Claude Design「健身工作室前台設計稿」（會員首頁、預約課程、教練今日課表）。規則見 `.claude/skills/layout-conventions` 的 Front-end shell。

| 檔案 | 用途 |
|---|---|
| `MemberLayout.tsx` | 前台版面：手機優先單欄＋底部分頁列；`mode="member"`（品牌藍）／`mode="coach"`（深青綠），處理強制改密碼與教練身份守衛 |
| `memberTheme.ts` | 前台主題（`FRONT_THEMES`）、內容欄寬、分頁列高度。前台色碼只寫在這裡 |
| `FrontPageHeader.tsx` | 頁首：小字（日期）＋大標，右側動作 |
| `FrontCard.tsx` | 白底圓角卡片；`highlighted` 以主題色外框標示 |
| `CoverTile.tsx` | 課程封面縮圖，沒有封面時以主題淺底＋圖示代替 |

前台頁面：`pages/member/Home`（首頁）、`pages/member/Book`（預約課程）、`pages/member/Me.tsx`（我的，會員與教練共用）、`pages/coach/Today`（今日課表）、`pages/coach/Attendance.tsx`（簽到紀錄）、`pages/coach/Payouts.tsx`（我的鐘點）。
既有的表格式頁面（我的預約、我的商品、購買商品）仍在前台版面內，之後再逐步改成卡片式。

# 管理員儀表板頁面規格（`/admin/dashboard`）

**狀態**：規格文件（spec-only），尚未實作。

## 0. 與先前規格的關係（重要澄清）

原本另外產出過一份會員端 `/member/dashboard`（場租教練儀表板）規格草案，經使用者確認**目前不需要**，該文件已移除，不在本次實作範圍內。

本文件才是使用者澄清後真正要的規格：管理員登入後看的首頁儀表板，目前系統**完全沒有**這個頁面——`frontend/src/router/index.tsx` 目前 `/admin` 的 index route 直接 `<Navigate to="reservations" replace />`，`AppLayout.tsx` 的 `adminMenuItems` 也沒有「儀表板」項目。本規格需要新增路由、新增選單項目，不是修改既有 stub。

參考視覺／元件用法（非資料）：`gym-system-design/project/ui_kits/dashboard/DashboardContent.jsx`——這份原型本來就是「管理員分析儀表板」（會員成長、營收、教練排行、圖表），比 `DASHBOARD_PAGE_SPEC.md` 誤用時更貼近本頁真正的受眾，版面節奏（統計列 + 內容列）可以直接沿用。

## 1. 目的／受眾

管理員登入後的首頁，一眼掌握：今日課程與時段、待處理的預約審核、營收概況。取代目前登入後直接跳去「預約審核列表」的體驗。

## 2. 路由與選單異動

- 新增 `frontend/src/pages/admin/Dashboard.tsx`。
- `frontend/src/router/index.tsx`：`/admin` 的 index route 從 `<Navigate to="reservations" replace />` 改為 `<Navigate to="dashboard" replace />`，並新增 `{ path: 'dashboard', element: <Dashboard /> }`。
- `frontend/src/components/AppLayout.tsx` 的 `adminMenuItems` 最前面加入 `{ key: '/admin/dashboard', label: '儀表板' }`。

## 3. 區塊 Sections

所有資料皆可用**現有** API 達成，不需新後端端點；後端目前 `GET /purchases`、`GET /reservations` 皆無日期區間篩選參數，本頁一律「抓全部、前端篩選/彙總」（見第 5 節資料落差）。

### A. 統計列（4 張 `Statistic` 卡，`gap:16px`，對應 `--space-md`）

| 統計項 | 資料來源 | 算法 |
|---|---|---|
| 今日預約數 | `listReservations()`（管理員可看全部） | `count(r => r.booking_date === today)` |
| 待審核預約數 | 同上 | `count(r => r.status === '待確認')`；卡片可點擊導向 `/admin/reservations` |
| 今日營收 | `listPurchases()`（管理員可看全部） | `sum(p.amount) where dayjs(p.purchase_date).isSame(today, 'day')`，格式 `NT$` 千分位（依 `gym-system-design/project/readme.md` Content fundamentals 的數字格式慣例） |
| 會員總數 | `listMembers()` | `.length`（可選標註其中教練人數：`filter(m => m.is_coach).length`） |

不做 `Statistic` 的 `trend` 上下箭頭（需要「上一期」比較基準，目前無此欄位，不捏造）。

### B. 今日課程與時段（Card + Table，主要內容區）

資料來源：`listCourses()` + `listReservations()`。

- 用 JS `dayjs().day()`（0=週日…6=週六）換算成本專案 `day_of_week`（1-6，週日不適用，`courses`/`time_slots` 皆同此定義）；若今天是週日，本區塊顯示空狀態文字「今日無排定課程」。
- 列出：`courses.filter(c => c.day_of_week === todayDow)` 依 `start_hour` 排序，每列顯示 課程名稱／時段（`start_hour:00`）／教練（`coachNameById`）／人數上限；再合併今日 `reservations`（`booking_date === today`）中非課程綁定的個別預約（`course_id === null`），一併依 `start_hour` 排序顯示商品名稱／會員／教練／人數／狀態（`StatusTag`）。兩種列可用一個共用欄位「類型」標示「固定課程」或「預約」區分。
- 不重建 `SlotPicker` 的完整週表格 UI——那是「時段設定」頁的職責；這裡只列今日這一天的排程明細，用 `Table`。

### C. 待審核預約（Card + Table，摘要版，連到完整頁）

- 資料：同 A 的 `listReservations()`，篩 `status === '待確認'`，取前 5-10 筆（依 `booking_date`/`start_hour` 排序，已是 API 預設順序）。
- 欄位沿用 `BookingReviewList.tsx` 的欄位子集（預約日期、會員、商品、教練、人數），**不含**核准/拒絕操作按鈕——本頁是總覽，操作動作留在 `/admin/reservations`；卡片標題右側放「查看全部」按鈕 `navigate('/admin/reservations')`。

### D. 營收趨勢圖（列為本期延後項目，見第 6 節）

原型 `DashboardContent.jsx` 有一個示意用長條圖，但那不是正式圖表庫產出。`gym-system-design/DESIGN_GUIDELINES.md` 第 11 節已將「圖表方案選型」列為待確認事項，本規格**不在此重複決定**——建議 D 區塊本期先不做，等圖表庫選定後再補。

## 4. Layout

沿用 `AppLayout` content 區（`24px` padding），由上而下：

1. 頁面標題「儀表板」（`Typography.Title level={4}`）
2. 統計列：4 張 `Card`／`Statistic`，flex row，`gap:16px`（`--space-md`），每張 `flex:1`
3. 雙欄內容列（寬螢幕 `gap:16px`，對應原型 `bottomRow`；窄螢幕垂直堆疊）：左欄「今日課程與時段」（B，較寬）、右欄「待審核預約」（C，較窄）
4. （延後）營收趨勢圖區塊，全寬，未來補上

元件全走 `Card`（白底、8px 圓角、`--border-secondary` 邊框、靜止無陰影）、`Statistic`、`Table`、`StatusTag`，與 `DESIGN_GUIDELINES.md` 第 7.2 節一致。

## 5. 資料落差（明確標註，不視為已解決）

- **D1 — 無日期區間查詢參數**：`GET /purchases`、`GET /reservations` 都是撈全部再前端篩選。資料量小的健身工作室 MVP 階段可接受；若未來資料量成長，建議加上 `date_from`/`date_to` query 參數做後端篩選，本規格不預先加後端改動。
- **D2 — 「今日營收」是「當日會員購買金額加總」，不是正式財務報表**：`purchases.amount` 是會員當下付給工作室的金額，資料模型中沒有退款/折讓/教練分潤等欄位，本統計是最簡化的當下收支近似值，不應被當作正式財務數字使用。
- **D3 — 「場地」沒有獨立資料表**：資料模型沒有「場地」實體，時段開放/關閉靠 `time_slots`（週固定樣板），今日的實際佔用情形要靠 B 區塊合併 `courses` + 當日 `reservations` 重建，不是查詢單一「場地狀態」端點得到的。

## 6. 確認結果

1. **統計卡**：確定為「今日預約數／待審核預約數／今日營收／會員總數」四項。
2. **營收趨勢圖（D 區塊）**：確定延後，第一版不做，等圖表庫選型後再補。
3. **選單項目「儀表板」圖示**：確定採用 `@ant-design/icons` 的 `DashboardOutlined`。

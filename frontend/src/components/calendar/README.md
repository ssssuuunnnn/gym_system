# calendar — 排程日曆原子組件

從 PulseFit 設計系統（`Agnes's Gym System Design`）匯入的 8 個原子組件，用來組出日／週／月排程日曆。
規範見 `.claude/skills/component-conventions/SKILL.md`：

- 顏色、圓角、字體一律走 `theme.useToken()`（antd v6），不寫全域 CSS、不寫死 hex。
- 共用常數、日期工具、色系集中在 **`shared.ts`**，各組件一律 import，不在個別檔案重覆宣告：
  - `DEFAULT_HOUR_HEIGHT`（時間格垂直尺規的唯一預設值，`TimeAxis` / `TimeSlotCell` /
    `EventBlock` / `NowIndicator` 共用）
  - `EventTone` 型別與 `eventToneStyle(token, tone)`（色系 → token 顏色）
  - `dateKey` / `startOfWeekMon` / `formatHour` / `formatMinutes`（皆基於 `dayjs`，不手刻日期運算）
  - 星期標籤走 `src/lib/weekday.ts`（`WEEKDAY_SHORT_MON_FIRST` / `weekdayLabel`）—— 全專案共用
- 每個組件都是受控、props 驅動：typed props interface + 逐欄 JSDoc、內部只留 transient state
  （如 `TimeSlotCell` 的 hover）、留 `style?` 逃生口並最後展開。
- `MiniCalendar` 與 antd `DatePicker` 面板功能重疊，之後可考慮改用 antd 原生元件；新的日期選擇
  需求優先用 antd（如篩選用 `DatePicker.RangePicker`），不要再自刻。

事件色系 `tone`（`EventBlock` / `EventChip` / `MonthDayCell` 共用，跨檢視顏色不變；定義於 `shared.ts`）：

| tone | 用途 |
|---|---|
| `blue` | 團體課程 |
| `purple` | 私人教練 |
| `gold` | 場地租借 / 包場 |
| `gray` | 場館維護 |
| `green` | 已完成 |

## 組件

### `TimeAxis`
日／週檢視左緣的小時刻度尺。`hourHeight` 是整個時間格的垂直尺規唯一來源——同一個值要傳給 `TimeSlotCell`、`EventBlock`、`NowIndicator`。用 `startHour` / `endHour` 裁到營業時間。

```tsx
<TimeAxis hourHeight={52} hideHour={15} />
```

### `TimeSlotCell`
時間格裡可點的空白時段。hover 反藍，點擊即開始建立預約。每個日欄放 24 個，置於 `position:relative` 容器內，再疊 `EventBlock` 與 `NowIndicator`。

```tsx
<TimeSlotCell height={52} first={h === 0} onClick={() => openForm(dateKey, h * 60)} />
```

### `DayHeaderCell`
時間格的 X 軸欄頭，每個可見日一個，放在捲動容器外，日期才會固定。

```tsx
<DayHeaderCell dow="星期二" label="9/1" isToday first />
```

### `EventBlock`
日／週時間格上的預約方塊，隨高度從三行退化到一行。重疊由 `colIndex` / `colCount` 並排，組件本身不算版位。

```tsx
<EventBlock
  title="團體有氧" timeText="09:00 – 10:00" metaText="林佩君 · A 教室 · 18/24"
  tone="blue" top={9 * 52} height={52}
/>
```

### `EventChip`
預約的單行版本，用於月檢視格或任何塞不下 `EventBlock` 的窄清單。

```tsx
<EventChip label="09:00 團體有氧" tone="blue" />
```

### `NowIndicator`
日／週格上標示當下時間的紅線，只在今天那一欄渲染。badge 只在時間軸層渲染一次（`showLabel`），並對 `TimeAxis` 傳 `hideHour` 讓整點文字讓位。

```tsx
<NowIndicator minutes={924} hourHeight={52} />
```

### `MonthDayCell`
月檢視的單日格：日期＋最多 `maxChips`（預設 3）個 `EventChip`＋「還有 N 筆」。在 `repeat(7, 1fr)` 格線裡排 35–42 個；點格慣例上切到該週檢視。

```tsx
<MonthDayCell
  day={3} isToday firstRow
  events={[{ label: '07:00 哈達瑜珈', tone: 'blue' }, { label: '11:00 私人課', tone: 'purple' }]}
/>
```

### `MiniCalendar`
側欄小月曆，週一為首。只負責移動主檢視的 anchor，不顯示事件。

```tsx
<MiniCalendar
  year={2026} month={8} todayKey="2026-09-01"
  selectedKeys={weekKeys} onSelect={(k) => setAnchor(k)} onPrev={prevMonth} onNext={nextMonth}
/>
```

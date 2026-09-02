場地時段格：橫軸週一–週六、縱軸 10:00–21:00，每格 60 分鐘（12 列）。
受控元件 —— 每格狀態由 `cellState` 決定，元件本身不持有狀態：
`empty`（空）／`booked`（私教）／`group`（團體課）／`buyout`（包場）／`closed`（管理員關閉）。
時段設定頁用 `onCellClick` 切換開放／關閉；唯讀檢視時省略 `onCellClick`。

```jsx
<SlotPicker
  cellState={(day, hour) => (hour === 12 ? 'closed' : 'empty')}
  onCellClick={(day, hour) => toggleSlot(day, hour)}
/>
```

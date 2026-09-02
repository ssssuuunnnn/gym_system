import React from 'react';
// 場地時段格 (SlotPicker)：橫軸 週一–週六（週日不顯示），縱軸 10:00–21:00 起始、每列 60 分鐘（共 12 列）。
// 受控元件 —— 每格狀態由父層透過 cellState 提供，元件本身不持有狀態。
const STATE_STYLE = {
  empty: { background: 'var(--gray-3)' },
  booked: { background: 'var(--gray-6)', color: '#fff' },   // 私教
  group: { background: 'var(--gray-7)', color: '#fff' },    // 團體課
  buyout: { background: 'var(--gray-10)', color: '#fff' },  // 包場
  closed: { background: 'var(--color-warning)', color: '#fff' }, // 管理員關閉
};
const DAYS = ['一', '二', '三', '四', '五', '六'];
const HOURS = Array.from({ length: 12 }, (_, i) => 10 + i);
export function SlotPicker(props) {
  const { cellState, onCellClick } = props;
  return React.createElement('div', { style: { overflowX: 'auto', fontFamily: 'var(--font-family)' } },
    React.createElement('table', { style: { borderCollapse: 'collapse', width: '100%', minWidth: 480 } },
      React.createElement('thead', null,
        React.createElement('tr', null,
          React.createElement('th', { style: { width: 60 } }),
          DAYS.map((d) => React.createElement('th', {
            key: d, style: { padding: 4, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' },
          }, '週' + d)),
        ),
      ),
      React.createElement('tbody', null,
        HOURS.map((hour) => React.createElement('tr', { key: hour },
          React.createElement('td', {
            style: { fontSize: 12, textAlign: 'right', paddingRight: 8, color: 'var(--text-tertiary)' },
          }, hour + ':00'),
          DAYS.map((_, dayIdx) => {
            const dayOfWeek = dayIdx + 1;
            const state = (cellState && cellState(dayOfWeek, hour)) || 'empty';
            return React.createElement('td', {
              key: dayOfWeek,
              onClick: () => onCellClick && onCellClick(dayOfWeek, hour),
              style: Object.assign({}, STATE_STYLE[state] || STATE_STYLE.empty, {
                height: 32, border: '2px solid var(--bg-container)', borderRadius: 'var(--radius-sm)',
                cursor: onCellClick ? 'pointer' : 'default', textAlign: 'center', fontSize: 11,
              }),
            });
          }),
        )),
      ),
    ),
  );
}

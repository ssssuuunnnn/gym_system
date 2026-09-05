import { useMemo } from 'react';
import { weekdayLabel } from '../lib/weekday';

/**
 * 時段選擇器（格狀時間表），對應「共用元件」章節規格：
 * 橫軸週一～週六（週日不顯示），縱軸 10:00–22:00 每列一格＝60 分鐘（共 12 列）。
 * 每格容量狀態：empty（空）／booked（私教）／group（團體課）／buyout（包場）／closed（管理員關閉）。
 * 手機窄螢幕版面（橫向滑動或列表式）待實作。
 */
export type SlotState = 'empty' | 'booked' | 'group' | 'buyout' | 'closed';

interface SlotPickerProps {
  cellState: (dayOfWeek: number, hour: number) => SlotState;
  onCellClick?: (dayOfWeek: number, hour: number) => void;
}

const STATE_STYLE: Record<SlotState, React.CSSProperties> = {
  empty: { background: '#f5f5f5' },
  booked: { background: '#bfbfbf' },
  group: { background: '#8c8c8c', color: '#fff' },
  buyout: { background: '#262626', color: '#fff' },
  closed: { background: '#ff7a45', color: '#fff' }, // 管理員關閉
};

const DAY_NUMS = [1, 2, 3, 4, 5, 6] as const; // 週一～週六（週日不顯示），對應 day_of_week
const HOURS = Array.from({ length: 12 }, (_, i) => 10 + i); // 10:00–21:00 起始

export default function SlotPicker({ cellState, onCellClick }: SlotPickerProps) {
  const grid = useMemo(
    () =>
      HOURS.map((hour) => ({
        hour,
        cells: DAY_NUMS.map((dayOfWeek) => ({ dayOfWeek, state: cellState(dayOfWeek, hour) })),
      })),
    [cellState],
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
        <thead>
          <tr>
            <th style={{ width: 60 }} />
            {DAY_NUMS.map((n) => (
              <th key={n} style={{ padding: 4, fontSize: 12 }}>{weekdayLabel(n)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map(({ hour, cells }) => (
            <tr key={hour}>
              <td style={{ fontSize: 12, textAlign: 'right', paddingRight: 8 }}>{hour}:00</td>
              {cells.map(({ dayOfWeek, state }) => (
                <td
                  key={dayOfWeek}
                  onClick={() => onCellClick?.(dayOfWeek, hour)}
                  style={{
                    ...STATE_STYLE[state],
                    height: 32,
                    border: '1px solid #fff',
                    cursor: onCellClick ? 'pointer' : 'default',
                    textAlign: 'center',
                  }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import type { CSSProperties } from 'react';
import { theme } from 'antd';
import { DEFAULT_HOUR_HEIGHT, formatHour } from './shared';

/**
 * 日／週檢視左緣的小時刻度尺。
 * `hourHeight` 是整個時間格的垂直尺規唯一來源，要與 TimeSlotCell、EventBlock、NowIndicator 傳同一個值。
 */
export interface TimeAxisProps {
  /** 起始小時（0–23），預設 0。 */
  startHour?: number;
  /** 結束小時（不含，1–24），預設 24。 */
  endHour?: number;
  /** 一小時的列高（px），須與時間格一致，預設 `DEFAULT_HOUR_HEIGHT`。 */
  hourHeight?: number;
  /** 欄寬（px），預設 68。 */
  width?: number;
  /** 隱藏指定整點的文字（NowIndicator 蓋住時讓位）。 */
  hideHour?: number | null;
  style?: CSSProperties;
}

export function TimeAxis(props: TimeAxisProps) {
  const {
    startHour = 0,
    endHour = 24,
    hourHeight = DEFAULT_HOUR_HEIGHT,
    width = 68,
    hideHour = null,
    style,
  } = props;
  const { token } = theme.useToken();
  const rows: number[] = [];
  for (let h = startHour; h < endHour; h++) rows.push(h);

  return (
    <div
      style={{
        width,
        flex: 'none',
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        fontFamily: token.fontFamily,
        ...style,
      }}
    >
      {rows.map((h, i) => (
        <div
          key={h}
          style={{
            height: hourHeight,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 10,
            fontSize: 12,
            color: token.colorTextTertiary,
            borderTop: i === 0 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {h === hideHour ? '' : formatHour(h)}
        </div>
      ))}
    </div>
  );
}

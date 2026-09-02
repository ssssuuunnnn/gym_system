import type { CSSProperties } from 'react';
import { theme } from 'antd';
import { EventChip, type EventTone } from './EventChip';

/**
 * 月檢視的單日格：日期數字＋最多 N 個 EventChip＋「還有 N 筆」溢出計數。
 * 在 `repeat(7, 1fr)` 格線裡排 35–42 個。點格慣例上切到該週檢視。
 */
export interface MonthDayCellProps {
  /** 日期數字。 */
  day: number | string;
  /** 當日的預約。 */
  events?: Array<{ label: string; tone?: EventTone; onClick?: () => void }>;
  /** 收合成「還有 N 筆」前顯示的 chip 數，預設 3。 */
  maxChips?: number;
  isToday?: boolean;
  /** 淡出鄰月溢入的日期。 */
  isOtherMonth?: boolean;
  /** 最上排傳 true（去掉上邊框）。 */
  firstRow?: boolean;
  /** 最左欄傳 true（去掉左邊框）。 */
  firstCol?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function MonthDayCell(props: MonthDayCellProps) {
  const {
    day,
    events = [],
    maxChips = 3,
    isToday = false,
    isOtherMonth = false,
    firstRow = false,
    firstCol = false,
    onClick,
    style,
  } = props;
  const { token } = theme.useToken();
  const shown = events.slice(0, maxChips);
  const rest = events.length - shown.length;

  return (
    <div
      onClick={onClick}
      style={{
        borderTop: firstRow ? 'none' : `1px solid ${token.colorBorderSecondary}`,
        borderLeft: firstCol ? 'none' : `1px solid ${token.colorBorderSecondary}`,
        padding: '6px 6px 4px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        cursor: onClick ? 'pointer' : 'default',
        background: isToday ? token.colorPrimaryBg : 'transparent',
        opacity: isOtherMonth ? 0.45 : 1,
        minWidth: 0,
        overflow: 'hidden',
        fontFamily: token.fontFamily,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          paddingLeft: 2,
          color: isToday ? token.colorPrimary : token.colorTextSecondary,
        }}
      >
        {day}
      </div>
      {shown.map((ev, i) => (
        <EventChip key={i} label={ev.label} tone={ev.tone} onClick={ev.onClick} />
      ))}
      {rest > 0 ? (
        <div style={{ fontSize: 11, color: token.colorTextTertiary, paddingLeft: 2 }}>
          {'還有 ' + rest + ' 筆'}
        </div>
      ) : null}
    </div>
  );
}

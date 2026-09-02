import type { CSSProperties } from 'react';
import { theme } from 'antd';
import dayjs from 'dayjs';
import { WEEKDAY_LABELS, dateKey, startOfWeekMon } from './shared';

/**
 * 日曆側欄用的小月曆，週一為首，標示今天與主檢視目前的範圍。
 * 只負責移動主檢視的 anchor，不顯示事件。
 */
export interface MiniCalendarProps {
  /** 西元年，例如 2026。 */
  year: number;
  /** 0 起算的月份（0 = 一月）。 */
  month: number;
  /** 今天的 "YYYY-MM-DD"，該格填滿主色。 */
  todayKey?: string;
  /** 主檢視目前顯示範圍的 "YYYY-MM-DD" 陣列。 */
  selectedKeys?: string[];
  /** 顯示週數，預設 6。 */
  weeks?: number;
  onSelect?: (dateKey: string, date: Date) => void;
  onPrev?: () => void;
  onNext?: () => void;
  style?: CSSProperties;
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  );
}

export function MiniCalendar(props: MiniCalendarProps) {
  const { year, month, todayKey, selectedKeys = [], weeks = 6, onSelect, onPrev, onNext, style } = props;
  const { token } = theme.useToken();

  // 先設為 1 號再改年月，避免當日為 31 而目標月僅 30 天時跨月
  const firstOfMonth = dayjs().date(1).year(year).month(month).startOf('day');
  const gridStart = startOfWeekMon(firstOfMonth);

  const navStyle: CSSProperties = {
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: token.borderRadiusSM,
    cursor: 'pointer',
    color: token.colorTextTertiary,
    fontSize: 14,
  };

  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const cell = gridStart.add(i, 'day');
    const k = dateKey(cell);
    const isToday = k === todayKey;
    const sel = selectedKeys.indexOf(k) >= 0;
    const other = cell.month() !== month;
    cells.push(
      <div
        key={k}
        onClick={onSelect ? () => onSelect(k, cell.toDate()) : undefined}
        style={{
          textAlign: 'center',
          fontSize: 11,
          lineHeight: '22px',
          borderRadius: token.borderRadiusSM,
          cursor: onSelect ? 'pointer' : 'default',
          color: isToday
            ? token.colorWhite
            : other
              ? token.colorTextQuaternary
              : token.colorTextSecondary,
          fontWeight: isToday ? 600 : 400,
          background: isToday ? token.colorPrimary : sel ? token.colorPrimaryBg : 'transparent',
        }}
      >
        {cell.date()}
      </div>,
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: token.fontFamily, ...style }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>
          {firstOfMonth.format('YYYY 年 M 月')}
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <div onClick={onPrev} style={navStyle}>
            <Chevron dir="left" />
          </div>
          <div onClick={onNext} style={navStyle}>
            <Chevron dir="right" />
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1 }}>
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: 'center',
              fontSize: 11,
              color: token.colorTextQuaternary,
              padding: '2px 0',
            }}
          >
            {d}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}

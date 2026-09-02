import type { CSSProperties } from 'react';
import { theme } from 'antd';

/**
 * 日／週檢視裡單日的欄頭：星期名在上、日期在下，位於可捲動時間格區的上方。
 * 欄頭列要放在捲動容器外，日期才會固定不隨小時捲走。
 */
export interface DayHeaderCellProps {
  /** 星期文字，例如 "星期三"。 */
  dow: string;
  /** 日期文字，例如 "9/3"。 */
  label: string;
  /** 標示今天：欄底淡藍、日期用主色圓標。 */
  isToday?: boolean;
  /** 週六／週日欄頭加灰底。 */
  isWeekend?: boolean;
  /** 最左欄傳 true（去掉左邊框）。 */
  first?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function DayHeaderCell(props: DayHeaderCellProps) {
  const { dow, label, isToday = false, isWeekend = false, first = false, onClick, style } = props;
  const { token } = theme.useToken();

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        padding: '8px 0 10px',
        textAlign: 'center',
        borderLeft: first ? 'none' : `1px solid ${token.colorBorderSecondary}`,
        cursor: onClick ? 'pointer' : 'default',
        background: isToday ? token.colorPrimaryBg : isWeekend ? token.colorFillAlter : 'transparent',
        fontFamily: token.fontFamily,
        ...style,
      }}
    >
      <div style={{ fontSize: 12, color: token.colorTextTertiary, lineHeight: 1.6 }}>{dow}</div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          lineHeight: '26px',
          display: 'inline-block',
          minWidth: 26,
          padding: '0 8px',
          borderRadius: 100,
          background: isToday ? token.colorPrimary : 'transparent',
          color: isToday ? token.colorWhite : token.colorText,
        }}
      >
        {label}
      </div>
    </div>
  );
}

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { theme } from 'antd';

/**
 * 日欄裡一格可點的空白時段。
 * hover 時反藍並加內框；disabled 為營業時間外的灰底、不可點。
 * 每欄放 24 格，置於 `position:relative` 容器內，再疊上 EventBlock 與 NowIndicator。
 */
export interface TimeSlotCellProps {
  /** 格高（px），須等於 TimeAxis 的 hourHeight，預設 52。 */
  height?: number;
  /** 該欄第一格傳 true（去掉上緣分隔線）。 */
  first?: boolean;
  /** 灰底並封鎖點擊（營業時間外）。 */
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function TimeSlotCell(props: TimeSlotCellProps) {
  const { height = 52, first = false, disabled = false, onClick, style } = props;
  const { token } = theme.useToken();
  const [hover, setHover] = useState(false);
  const on = hover && !disabled;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={disabled ? undefined : onClick}
      style={{
        height,
        boxSizing: 'border-box',
        borderTop: first ? 'none' : `1px solid ${token.colorBorderSecondary}`,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background .15s',
        background: disabled ? token.colorFillAlter : on ? token.colorPrimaryBg : 'transparent',
        boxShadow: on ? `inset 0 0 0 1px ${token.colorPrimaryBorder}` : 'none',
        ...style,
      }}
    />
  );
}

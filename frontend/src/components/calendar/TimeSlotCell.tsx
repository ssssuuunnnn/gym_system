import type { CSSProperties } from 'react';
import { useState } from 'react';
import { theme } from 'antd';

/**
 * 日欄裡一格可點的空白時段。
 * hover 時反藍並加內框；`disabled` 為不可設定的時段（擋點擊，例如過去日期）；
 * `closed` 為已關閉的時段——`disabled && closed`（過去且曾經關閉）用 `token.red1`
 * 呈現、不可點擊；非 disabled 的 `closed`（現在／未來，仍可點擊切回開放）用 `token.red2`，
 * hover 轉錯誤色提示會重新開放。
 * 每欄放數格，置於 `position:relative` 容器內，再疊上 EventBlock 與 NowIndicator。
 */
export interface TimeSlotCellProps {
  /** 格高（px），須等於 TimeAxis 的 hourHeight，預設 `DEFAULT_HOUR_HEIGHT`。 */
  height?: number;
  /** 該欄第一格傳 true（去掉上緣分隔線）。 */
  first?: boolean;
  /** 灰底並封鎖點擊（不可設定的時段）。 */
  disabled?: boolean;
  /** 已關閉的時段：灰底但仍可點擊切回開放。 */
  closed?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function TimeSlotCell(props: TimeSlotCellProps) {
  const { height = 52, first = false, disabled = false, closed = false, onClick, style } = props;
  const { token } = theme.useToken();
  const [hover, setHover] = useState(false);
  const on = hover && !disabled;

  const background = disabled
    ? closed
      ? token.red1
      : token.colorFillAlter
    : closed
      ? on
        ? token.colorErrorBg
        : token.red2
      : on
        ? token.colorPrimaryBg
        : 'transparent';

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
        background,
        boxShadow: on && !closed ? `inset 0 0 0 1px ${token.colorPrimaryBorder}` : 'none',
        ...style,
      }}
    />
  );
}

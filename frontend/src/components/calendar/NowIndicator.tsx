import type { CSSProperties } from 'react';
import { theme } from 'antd';

/**
 * 日／週格上標示當下時間的紅色水平線與圓點，只在今天那一欄渲染。
 * 放在 `position:relative` 的日欄內。badge 只在時間軸層渲染一次（showLabel），
 * 並對 TimeAxis 傳 hideHour 讓整點文字讓位。
 */
export interface NowIndicatorProps {
  /** 自午夜起算的分鐘數。 */
  minutes: number;
  /** 須與時間格的 hourHeight 一致，預設 52。 */
  hourHeight?: number;
  /** 時間格渲染的第一個小時，預設 0。 */
  startHour?: number;
  /** badge 文字，預設由 minutes 推得 HH:MM。 */
  label?: string;
  /** 是否渲染 badge，只有最左／時間軸層該設 true。 */
  showLabel?: boolean;
  /** 是否渲染水平線，badge-only 層設 false，預設 true。 */
  showLine?: boolean;
  /** badge 寬度（px），取 TimeAxis 寬度減 10，預設 58。 */
  labelWidth?: number;
  style?: CSSProperties;
}

function pad(n: number): string {
  return n < 10 ? '0' + n : '' + n;
}

export function NowIndicator(props: NowIndicatorProps) {
  const {
    minutes = 0,
    hourHeight = 52,
    startHour = 0,
    label,
    showLabel = false,
    showLine = true,
    labelWidth = 58,
    style,
  } = props;
  const { token } = theme.useToken();
  const top = ((minutes - startHour * 60) / 60) * hourHeight;
  const text = label || pad(Math.floor(minutes / 60)) + ':' + pad(minutes % 60);

  return (
    <>
      {showLine ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top,
            height: 0,
            borderTop: `2px solid ${token.colorError}`,
            zIndex: 4,
            pointerEvents: 'none',
            ...style,
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: -4,
              top: -4,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: token.colorError,
            }}
          />
        </div>
      ) : null}
      {showLabel ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: top - 9,
            width: labelWidth,
            textAlign: 'right',
            fontSize: 11,
            fontWeight: 600,
            color: token.colorWhite,
            background: token.colorError,
            borderRadius: token.borderRadiusSM,
            padding: '1px 4px',
            boxSizing: 'border-box',
            fontFamily: token.fontFamily,
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          {text}
        </div>
      ) : null}
    </>
  );
}

import type { CSSProperties, MouseEvent } from 'react';
import { theme } from 'antd';
import { DEFAULT_HOUR_HEIGHT, eventToneStyle, type EventTone } from './shared';

/**
 * 一筆預約，在日欄裡以絕對定位的方塊呈現。
 * 依方塊高度分層：≥66px 顯示三行（標題／時間／meta），≥42px 兩行，更短只留標題。
 * 重疊由 colIndex / colCount 並排決定，組件本身不計算版位。
 */
export interface EventBlockProps {
  title: string;
  /** 第二行，例如 "09:00 – 10:00"，height ≥ 42 時顯示。 */
  timeText?: string;
  /** 第三行，例如 "林佩君 · A 教室 · 18/24"，height ≥ 66 時顯示。 */
  metaText?: string;
  /** 色系，預設 "blue"。 */
  tone?: EventTone;
  /** 距欄頂位移（px）＝ startMin / 60 * hourHeight。 */
  top?: number;
  /** 方塊高度（px）＝ duration / 60 * hourHeight，最小 22。 */
  height?: number;
  /** 重疊並排時的欄索引，預設 0。 */
  colIndex?: number;
  /** 此重疊群組的並排欄數，預設 1。 */
  colCount?: number;
  /** 標記跨日預約的接續段（前綴 ↳）。 */
  continued?: boolean;
  onClick?: (e: MouseEvent) => void;
  style?: CSSProperties;
}

export function EventBlock(props: EventBlockProps) {
  const {
    title,
    timeText,
    metaText,
    tone = 'blue',
    top = 0,
    height = DEFAULT_HOUR_HEIGHT,
    colIndex = 0,
    colCount = 1,
    continued = false,
    onClick,
    style,
  } = props;
  const { token } = theme.useToken();
  const t = eventToneStyle(token, tone);
  const h = Math.max(22, height);

  const line: CSSProperties = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        top,
        height: h,
        left: `calc(${(colIndex / colCount) * 100}% + 3px)`,
        width: `calc(${100 / colCount}% - 6px)`,
        background: t.bg,
        border: `1px solid ${t.bd}`,
        borderLeft: `3px solid ${t.dot}`,
        borderRadius: token.borderRadius,
        color: t.fg,
        padding: '4px 6px',
        overflow: 'hidden',
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: token.fontFamily,
        zIndex: 2,
        ...style,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, ...line }}>
        {(continued ? '↳ ' : '') + title}
      </div>
      {h >= 42 && timeText ? (
        <div style={{ fontSize: 11, lineHeight: 1.5, opacity: 0.85, ...line }}>{timeText}</div>
      ) : null}
      {h >= 66 && metaText ? (
        <div style={{ fontSize: 11, lineHeight: 1.5, opacity: 0.72, ...line }}>{metaText}</div>
      ) : null}
    </div>
  );
}

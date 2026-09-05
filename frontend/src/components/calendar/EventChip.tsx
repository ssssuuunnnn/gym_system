import type { CSSProperties } from 'react';
import { theme } from 'antd';
import { eventToneStyle, type EventTone } from './shared';

export type { EventTone };

/**
 * 預約的單行版本，用於月檢視格或任何塞不下 EventBlock 的窄清單。
 * 與 EventBlock 共用同一組 tone，事件跨檢視時顏色不變。
 */
export interface EventChipProps {
  /** 通常是 "HH:MM 標題"，過長以 … 截斷。 */
  label: string;
  /** 色系，預設 "blue"。 */
  tone?: EventTone;
  onClick?: () => void;
  style?: CSSProperties;
}

export function EventChip(props: EventChipProps) {
  const { label, tone = 'blue', onClick, style } = props;
  const { token } = theme.useToken();
  const t = eventToneStyle(token, tone);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        lineHeight: '18px',
        padding: '0 5px',
        borderRadius: token.borderRadiusSM,
        background: t.bg,
        color: t.fg,
        minWidth: 0,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: token.fontFamily,
        ...style,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.dot, flex: 'none' }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

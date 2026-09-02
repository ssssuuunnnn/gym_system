import type { CSSProperties } from 'react';
import { theme } from 'antd';

/** 事件色系，對應預約類型：blue 團體課程 / purple 私人教練 / gold 場地租借 / green 已完成 / gray 場館維護。 */
export type EventTone = 'blue' | 'purple' | 'gold' | 'green' | 'gray';

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
  const TONES: Record<EventTone, { bg: string; fg: string; dot: string }> = {
    blue: { bg: token.blue1, fg: token.blue8, dot: token.blue6 },
    purple: { bg: token.purple1, fg: token.purple8, dot: token.purple6 },
    gold: { bg: token.gold1, fg: token.gold8, dot: token.gold6 },
    green: { bg: token.green1, fg: token.green8, dot: token.green6 },
    gray: { bg: token.colorFillTertiary, fg: token.colorTextSecondary, dot: token.colorTextTertiary },
  };
  const t = TONES[tone] || TONES.blue;

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

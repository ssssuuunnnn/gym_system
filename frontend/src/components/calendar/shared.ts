import { theme } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

/**
 * calendar 原子組件的共用常數、日期工具與色系 —— 單一來源，各組件一律 import 此檔，
 * 不在個別檔案重新宣告 pad()／DOW／TONES／hourHeight 預設值。
 */

type CalendarToken = ReturnType<typeof theme.useToken>['token'];

/** 一小時的預設列高（px）。時間格的垂直尺規唯一來源，TimeAxis／TimeSlotCell／EventBlock／NowIndicator 共用。 */
export const DEFAULT_HOUR_HEIGHT = 52;

/** 星期標籤，週一為首（index 0 = 週一）。 */
export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;

/** 事件色系，對應預約類型：blue 團體課程 / purple 私人教練 / gold 場地租借 / green 已完成 / gray 場館維護。 */
export type EventTone = 'blue' | 'purple' | 'gold' | 'green' | 'gray';

/** 事件色系 → token 顏色。EventBlock 用四個欄位，EventChip 只用 bg／fg／dot。 */
export function eventToneStyle(
  token: CalendarToken,
  tone: EventTone = 'blue',
): { bg: string; bd: string; fg: string; dot: string } {
  const map: Record<EventTone, { bg: string; bd: string; fg: string; dot: string }> = {
    blue: { bg: token.blue1, bd: token.blue3, fg: token.blue8, dot: token.blue6 },
    purple: { bg: token.purple1, bd: token.purple3, fg: token.purple8, dot: token.purple6 },
    gold: { bg: token.gold1, bd: token.gold3, fg: token.gold8, dot: token.gold6 },
    green: { bg: token.green1, bd: token.green3, fg: token.green8, dot: token.green6 },
    gray: {
      bg: token.colorFillTertiary,
      bd: token.colorBorder,
      fg: token.colorTextSecondary,
      dot: token.colorTextTertiary,
    },
  };
  return map[tone] || map.blue;
}

/** 任意日期輸入 → "YYYY-MM-DD"。 */
export function dateKey(d: Dayjs | Date | string): string {
  return dayjs(d).format('YYYY-MM-DD');
}

/** 該週的週一（當日 00:00）。 */
export function startOfWeekMon(d: Dayjs | Date | string): Dayjs {
  const x = dayjs(d).startOf('day');
  return x.subtract((x.day() + 6) % 7, 'day');
}

/** 整點小時 → "HH:00"。 */
export function formatHour(hour: number): string {
  return String(hour).padStart(2, '0') + ':00';
}

/** 自午夜起算的分鐘數 → "HH:MM"。 */
export function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

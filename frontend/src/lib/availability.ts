import type { Dayjs } from 'dayjs';
import type { TimeSlot } from '../api/timeSlots';

/**
 * 時段可預約性判斷的單一來源：只看 time_slots（該日期的例外設定）。
 * 前端（本檔）與後端（reservations.py `_check_slot_open`）須維持相同判斷邏輯。
 */
export type Availability = 'open' | 'closed';

/** dayjs `.day()`（0=週日…6=週六）轉本專案慣用的 ISO 軸（1=週一…7=週日）。 */
export function isoWeekday(d: Dayjs): number {
  return d.day() === 0 ? 7 : d.day();
}

export function buildOverrideMap(slots: TimeSlot[] | undefined): Map<string, boolean> {
  return new Map((slots ?? []).map((s) => [`${s.slot_date}-${s.start_hour}`, s.is_open]));
}

export function resolveAvailability(date: Dayjs, hour: number, overridesByKey: Map<string, boolean>): Availability {
  const isOpen = overridesByKey.get(`${date.format('YYYY-MM-DD')}-${hour}`) ?? true;
  return isOpen ? 'open' : 'closed';
}

import dayjs, { type Dayjs } from 'dayjs';
import { weekdayShort } from '../../../../lib/weekday';
import { isoWeekday } from '../../../../lib/availability';
import type { CourseDetail, CourseSession, ScheduleEndMode, SessionSource } from '../../../../api/courses';

/**
 * 團體課程「課程時段」的排程展開。
 *
 * 模型：一門課 = 一份排程規格（上課星期多選 + 單一時間 + 開課期間），展開成 `course_sessions`。
 * 可逐堂「停課」（保留紀錄）、可「加開單堂」臨時課；不做逐堂改時間。日曆唯讀。
 */

/** 週曆與時間下拉的可選範圍（含頭不含尾）；對齊全站 time_slots 10:00–21:00 與 SlotPicker 預設。 */
export const CALENDAR_START_HOUR = 10;
export const CALENDAR_END_HOUR = 22;

/** 整點時間選項（600 = 10:00 … 1260 = 21:00）；全站 start_hour 皆為整點。 */
export const TIME_OPTIONS: { value: number; label: string }[] = (() => {
  const out: { value: number; label: string }[] = [];
  for (let h = CALENDAR_START_HOUR; h < CALENDAR_END_HOUR; h += 1) {
    out.push({ value: h * 60, label: formatMinute(h * 60) });
  }
  return out;
})();

export function formatMinute(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "2026-09-07" → "9/7(一)" */
export function formatDateKey(key: string): string {
  const d = dayjs(key);
  return `${d.month() + 1}/${d.date()}(${weekdayShort(isoWeekday(d))})`;
}

/** 排程規則／課堂的日期選擇：不能選今天以前。 */
export function disabledPastDate(d: Dayjs): boolean {
  return d.isBefore(dayjs(), 'day');
}

/** 某 (日期, 時間) 是否為已關閉時段（time_slots）。 */
export type IsSlotClosed = (dateKey: string, minute: number) => boolean;

export interface ScheduleSpec {
  /** 上課星期（ISO 1–7），可多個 */
  weekdays: number[];
  /** 上課時間（自午夜起算分鐘，整點） */
  startMinute: number;
  /** 開課起日 YYYY-MM-DD（空字串＝未設定） */
  startDate: string;
  endMode: ScheduleEndMode;
  /** 結束日 YYYY-MM-DD（endMode = 結束日） */
  endDate: string;
  /** 開課週數（endMode = 週數） */
  weekCount: number;
}

export interface ExtraSession {
  key: string;
  dateKey: string;
  minute: number;
}

export interface PreviewSession {
  key: string;
  dateKey: string;
  minute: number;
  source: SessionSource;
  isCancelled: boolean;
  /** 排程課堂落在公休時段：仍顯示（標「時段公休」），但不計入堂數、儲存時略過 */
  closedSlot: boolean;
}

const MAX_WEEKS = 104;

export function emptyScheduleSpec(): ScheduleSpec {
  return { weekdays: [], startMinute: 10 * 60, startDate: '', endMode: '週數', weekCount: 8, endDate: '' };
}

/** 排程期間的結束日（含）；資訊不足時回傳 null。 */
export function scheduleEndDate(spec: ScheduleSpec): Dayjs | null {
  if (!spec.startDate) return null;
  if (spec.endMode === '結束日') return spec.endDate ? dayjs(spec.endDate) : null;
  const weeks = Math.min(MAX_WEEKS, Math.max(1, spec.weekCount || 0));
  return dayjs(spec.startDate).add(weeks * 7 - 1, 'day');
}

/**
 * 依排程規格 + 停課集合 + 加開清單，展開出排序後的課堂清單。
 * 落在公休時段、且不在 `confirmedDates`（編輯時＝已儲存的正常排程課堂日期）內的排程課堂
 * 會被標 `closedSlot`（仍顯示、標「時段公休」，但不計入堂數、`toSessionPayload` 會濾掉）。
 * 以 (日期, 整點) 去重——同一格只留一堂（排程先於加開）。
 */
export function expandSchedule(
  spec: ScheduleSpec,
  cancelled: Set<string>,
  extras: ExtraSession[],
  isClosed: IsSlotClosed,
  confirmedDates: Set<string>,
): PreviewSession[] {
  const out: PreviewSession[] = [];
  const end = scheduleEndDate(spec);
  if (spec.startDate && end && spec.weekdays.length > 0) {
    const wd = new Set(spec.weekdays);
    let d = dayjs(spec.startDate);
    while (!d.isAfter(end, 'day')) {
      if (wd.has(isoWeekday(d))) {
        const dateKey = d.format('YYYY-MM-DD');
        const isCancelled = cancelled.has(dateKey);
        out.push({
          key: `s-${dateKey}`,
          dateKey,
          minute: spec.startMinute,
          source: '排程',
          isCancelled,
          closedSlot:
            !confirmedDates.has(dateKey) &&
            !isCancelled &&
            isClosed(dateKey, spec.startMinute),
        });
      }
      d = d.add(1, 'day');
    }
  }
  for (const x of extras) {
    out.push({
      key: x.key,
      dateKey: x.dateKey,
      minute: x.minute,
      source: '加開',
      isCancelled: false,
      closedSlot: false,
    });
  }
  // 依「星期幾（週一…週日）→ 日期 → 時間」排列：週二整組、再週三整組、再單次加開的星期
  out.sort((a, b) => {
    const wa = isoWeekday(dayjs(a.dateKey));
    const wb = isoWeekday(dayjs(b.dateKey));
    if (wa !== wb) return wa - wb;
    if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? -1 : 1;
    return a.minute - b.minute;
  });
  const seen = new Set<string>();
  return out.filter((s) => {
    const k = `${s.dateKey}-${Math.floor(s.minute / 60)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** 排程摘要：「每週一、三、五 10:00 · 2026/09/14 – 2026/10/11 · 共 10 堂」 */
export function scheduleSummary(spec: ScheduleSpec, activeCount: number, closedCount = 0): string {
  if (spec.weekdays.length === 0 || !spec.startDate) return '尚未設定排程';
  const days = [...spec.weekdays].sort((a, b) => a - b).map(weekdayShort).join('、');
  const head = `每週${days} ${formatMinute(spec.startMinute)}`;
  if (spec.endMode === '結束日' && !spec.endDate) return `${head} · 請選擇開課結束日`;
  const end = scheduleEndDate(spec);
  const range = end
    ? `${dayjs(spec.startDate).format('YYYY/MM/DD')} – ${end.format('YYYY/MM/DD')}`
    : dayjs(spec.startDate).format('YYYY/MM/DD');
  const closedNote = closedCount > 0 ? `（${closedCount} 堂落在公休時段，不會建立）` : '';
  return `${head} · ${range} · 共 ${activeCount} 堂${closedNote}`;
}

export function specFromDetail(detail: CourseDetail): ScheduleSpec {
  return {
    weekdays: detail.weekdays ?? [],
    startMinute: (detail.start_hour ?? 10) * 60,
    startDate: detail.start_date ?? '',
    endMode: detail.end_mode ?? '週數',
    endDate: detail.end_date ?? '',
    weekCount: detail.week_count ?? 8,
  };
}

export function cancelledFromDetail(detail: CourseDetail): Set<string> {
  return new Set(
    detail.sessions.filter((s) => s.source === '排程' && s.is_cancelled).map((s) => s.session_date),
  );
}

/** 編輯時已儲存的「正常」排程課堂日期——這些不再被視為公休（即使該時段之後才被關閉）。 */
export function confirmedFromDetail(detail: CourseDetail): Set<string> {
  return new Set(
    detail.sessions.filter((s) => s.source === '排程' && !s.is_cancelled).map((s) => s.session_date),
  );
}

export function extrasFromDetail(detail: CourseDetail): ExtraSession[] {
  return detail.sessions
    .filter((s) => s.source === '加開')
    .map((s) => ({ key: `x-${s.session_date}-${s.start_minute}`, dateKey: s.session_date, minute: s.start_minute }));
}

export function toSessionPayload(sessions: PreviewSession[], durationMinutes: number): CourseSession[] {
  // 落在公休時段的排程課堂不建立
  return sessions
    .filter((s) => !s.closedSlot)
    .map((s, idx) => ({
      position: idx,
      session_date: s.dateKey,
      start_minute: s.minute,
      duration_minutes: durationMinutes,
      source: s.source,
      is_cancelled: s.isCancelled,
    }));
}

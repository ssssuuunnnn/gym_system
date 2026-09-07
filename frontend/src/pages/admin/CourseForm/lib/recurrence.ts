import dayjs, { type Dayjs } from 'dayjs';
import { weekdayShort } from '../../../../lib/weekday';
import { isoWeekday } from '../../../../lib/availability';
import type {
  CourseDetail,
  CourseScheduleRule,
  CourseSession,
  ScheduleEndMode,
  ScheduleFrequency,
} from '../../../../api/courses';

/**
 * 團體課程「課程時段」的排課週期引擎。
 *
 * 移植自 Claude Design `GroupCourseCreate.dc.html` 的邏輯：一列排課規則展開成多筆課堂，
 * 可逐堂覆寫日期／時間（overrides）、移除（removed），或於日曆單次加開（extras）。
 * 儲存時 `toRulePayload` / `toSessionPayload` 轉成後端 payload；編輯載入時 `fromDetail` 反推回引擎狀態。
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

/** 單堂時長下拉選項（分鐘）。 */
export const DURATION_OPTIONS = [30, 45, 50, 60, 75, 90, 120];

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

export interface RuleState {
  /** 'r{position}'，供 occId 前綴用，跨編輯穩定 */
  id: string;
  position: number;
  startKey: string;
  minute: number;
  freq: ScheduleFrequency;
  endMode: ScheduleEndMode;
  /** 連續週數（endMode = 連續） */
  count: number;
  /** 結束日 YYYY-MM-DD（endMode = 結束於） */
  endKey: string;
}

export interface EngineState {
  rules: RuleState[];
  overrides: Record<string, { dateKey: string; minute: number }>;
  removed: Record<string, boolean>;
  extras: { id: string; dateKey: string; minute: number }[];
  /** extras id 流水號 */
  seq: number;
}

export interface Occurrence {
  occId: string;
  /** 1 起算的規則序號；單次加開為 0 */
  rulePosition: number;
  isExtra: boolean;
  origKey: string;
  origMinute: number;
  dateKey: string;
  minute: number;
  adjusted: boolean;
}

const MAX_OPEN_ENDED = 60;

function ruleWeekStep(freq: ScheduleFrequency): number {
  return freq === '隔週' ? 14 : 7;
}

/** 依規則 + 覆寫 + 移除 + 單次加開，展開出排序後的課堂清單。 */
export function expand(state: EngineState): Occurrence[] {
  const out: Occurrence[] = [];
  for (const r of state.rules) {
    const step = ruleWeekStep(r.freq);
    const base = dayjs(r.startKey);
    const limit = r.endMode === '連續' ? Math.max(0, r.count) : MAX_OPEN_ENDED;
    const endAt = r.endMode === '結束於' ? dayjs(r.endKey) : null;
    for (let i = 0; i < limit; i += 1) {
      const d = base.add(i * step, 'day');
      if (endAt && d.isAfter(endAt, 'day')) break;
      const occId = `${r.id}:${i}`;
      if (state.removed[occId]) continue;
      const ov = state.overrides[occId];
      const origKey = d.format('YYYY-MM-DD');
      out.push({
        occId,
        rulePosition: r.position + 1,
        isExtra: false,
        origKey,
        origMinute: r.minute,
        dateKey: ov ? ov.dateKey : origKey,
        minute: ov ? ov.minute : r.minute,
        adjusted: !!ov,
      });
    }
  }
  for (const x of state.extras) {
    if (state.removed[x.id]) continue;
    out.push({
      occId: x.id,
      rulePosition: 0,
      isExtra: true,
      origKey: x.dateKey,
      origMinute: x.minute,
      dateKey: x.dateKey,
      minute: x.minute,
      adjusted: false,
    });
  }
  out.sort((a, b) => (a.dateKey === b.dateKey ? a.minute - b.minute : a.dateKey < b.dateKey ? -1 : 1));
  return out;
}

/** 規則摘要：「共 8 堂 · 每週一」 */
export function ruleSummary(state: EngineState, rule: RuleState): string {
  const count =
    rule.endMode === '連續'
      ? Math.max(0, rule.count)
      : expand({ ...state, extras: [], overrides: {}, removed: {} }).filter(
          (o) => o.occId.startsWith(`${rule.id}:`),
        ).length;
  const prefix = rule.freq === '隔週' ? '隔週' : '每週';
  return `共 ${count} 堂 · ${prefix}${weekdayShort(isoWeekday(dayjs(rule.startKey)))}`;
}

export function makeRule(position: number, id: string): RuleState {
  const today = dayjs();
  return {
    id,
    position,
    startKey: today.format('YYYY-MM-DD'),
    minute: 10 * 60,
    freq: '每週',
    endMode: '結束於',
    count: 4,
    endKey: today.add(56, 'day').format('YYYY-MM-DD'),
  };
}

/** 新增課程的初始狀態：一列預設規則。 */
export function initialCreateState(): EngineState {
  return { rules: [makeRule(0, 'r0')], overrides: {}, removed: {}, extras: [], seq: 1 };
}

/** 排課規則的日期選擇：不能選今天以前。 */
export function disabledPastDate(d: Dayjs): boolean {
  return d.isBefore(dayjs(), 'day');
}

/** 複製課程的初始狀態：清空排課，開課時間需重新設定。 */
export function emptyScheduleState(): EngineState {
  return { rules: [], overrides: {}, removed: {}, extras: [], seq: 0 };
}

/** 編輯載入：由後端巢狀資料反推回引擎狀態。 */
export function fromDetail(detail: CourseDetail): EngineState {
  const rules: RuleState[] = detail.rules
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      id: `r${r.position}`,
      position: r.position,
      startKey: r.start_date,
      minute: r.start_minute,
      freq: r.frequency,
      endMode: r.end_mode,
      count: r.week_count ?? 4,
      endKey: r.end_date ?? dayjs(r.start_date).add(56, 'day').format('YYYY-MM-DD'),
    }));

  const overrides: EngineState['overrides'] = {};
  const removed: EngineState['removed'] = {};
  const ruleSessions = detail.sessions.filter((s) => s.source === '規則');

  for (const r of rules) {
    const step = ruleWeekStep(r.freq);
    const base = dayjs(r.startKey);
    const limit = r.endMode === '連續' ? Math.max(0, r.count) : MAX_OPEN_ENDED;
    const endAt = r.endMode === '結束於' ? dayjs(r.endKey) : null;
    const pool = ruleSessions.filter((s) => s.rule_position === r.position + 1);
    for (let i = 0; i < limit; i += 1) {
      const d = base.add(i * step, 'day');
      if (endAt && d.isAfter(endAt, 'day')) break;
      const key = d.format('YYYY-MM-DD');
      const occId = `${r.id}:${i}`;
      const exact = pool.find((s) => !s.adjusted && s.session_date === key && s.start_minute === r.minute);
      if (exact) continue;
      const adjusted = pool.find(
        (s) => s.adjusted && s.origin_date === key && s.origin_minute === r.minute,
      );
      if (adjusted) {
        overrides[occId] = { dateKey: adjusted.session_date, minute: adjusted.start_minute };
        continue;
      }
      removed[occId] = true;
    }
  }

  const extras = detail.sessions
    .filter((s) => s.source === '單次加開')
    .map((s, n) => ({ id: `x${n}`, dateKey: s.session_date, minute: s.start_minute }));

  return { rules, overrides, removed, extras, seq: extras.length };
}

export function toRulePayload(rules: RuleState[]): CourseScheduleRule[] {
  return rules.map((r) => ({
    position: r.position,
    start_date: r.startKey,
    start_minute: r.minute,
    frequency: r.freq,
    end_mode: r.endMode,
    week_count: r.endMode === '連續' ? r.count : null,
    end_date: r.endMode === '結束於' ? r.endKey : null,
  }));
}

export function toSessionPayload(occs: Occurrence[], durationMinutes: number): CourseSession[] {
  return occs.map((o, idx) => ({
    position: idx,
    session_date: o.dateKey,
    start_minute: o.minute,
    duration_minutes: durationMinutes,
    source: o.isExtra ? '單次加開' : '規則',
    rule_position: o.isExtra ? null : o.rulePosition,
    adjusted: o.adjusted,
    origin_date: o.adjusted ? o.origKey : null,
    origin_minute: o.adjusted ? o.origMinute : null,
  }));
}

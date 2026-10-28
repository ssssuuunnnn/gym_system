import dayjs from 'dayjs';
import type { SegmentFilters, SegmentMember } from '../../../api/memberSegments';

const DATE = 'YYYY-MM-DD';

/** 預設：最近 3 個月有上過課的會員 */
export function defaultFilters(): SegmentFilters {
  return {
    start: dayjs().subtract(3, 'month').format(DATE),
    end: dayjs().format(DATE),
    kind: '全部',
    coach_id: null,
    min_attended: 1,
    max_remaining_hours: null,
    inactive_days: null,
  };
}

/** 常用名單：一鍵帶入條件 */
export const PRESETS: { key: string; label: string; hint: string; filters: () => SegmentFilters }[] = [
  {
    key: 'renew',
    label: '續約提醒',
    hint: '最近 3 個月有來、剩餘 2 堂以下',
    filters: () => ({ ...defaultFilters(), max_remaining_hours: 2 }),
  },
  {
    key: 'winback',
    label: '喚回老會員',
    hint: '最近 6 個月有來過、但超過 30 天沒來',
    filters: () => ({ ...defaultFilters(), start: dayjs().subtract(6, 'month').format(DATE), inactive_days: 30 }),
  },
  {
    key: 'loyal',
    label: '忠實會員',
    hint: '最近 3 個月出席 8 次以上',
    filters: () => ({ ...defaultFilters(), min_attended: 8 }),
  },
];

/** 把篩選條件寫成一行人看得懂的文字（受眾紀錄用） */
export function describeFilters(f: SegmentFilters, coachName?: (id: number) => string | undefined): string {
  const parts = [`${f.start} ～ ${f.end}`];
  if (f.kind !== '全部') parts.push(f.kind);
  if (f.coach_id != null) parts.push(coachName?.(f.coach_id) ?? `教練 #${f.coach_id}`);
  parts.push(`出席 ≥ ${f.min_attended} 次`);
  if (f.max_remaining_hours != null) parts.push(`剩餘 ≤ ${f.max_remaining_hours} 堂`);
  if (f.inactive_days != null) parts.push(`超過 ${f.inactive_days} 天沒來`);
  return parts.join('・');
}

function csvCell(value: string | number | null): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 下載名單 CSV（加 BOM，Excel 開啟中文不會亂碼） */
export function downloadCsv(members: SegmentMember[]) {
  const header = ['姓名', '帳號', '手機', '期間出席次數', '最後上課', '剩餘堂數', 'LINE'];
  const lines = [
    header,
    ...members.map((m) => [m.name, m.username, m.phone, m.attended_count, m.last_attended, m.remaining_hours, m.reach]),
  ].map((row) => row.map(csvCell).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `會員名單_${dayjs().format('YYYYMMDD')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

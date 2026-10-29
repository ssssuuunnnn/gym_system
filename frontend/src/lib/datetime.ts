import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

/**
 * 後端的時間戳記（created_at／paid_at／updated_at 等）以 UTC 存放且不帶時區（datetime.utcnow()），
 * 直接 dayjs(value) 會被當成本地時間而少 8 小時。顯示前一律經過此函式轉成本地時間。
 */
export function formatServerTime(value: string | null | undefined, format = 'YYYY-MM-DD HH:mm'): string {
  if (!value) return '—';
  return dayjs.utc(value).local().format(format);
}

/** 後端時間戳記顯示成「剛剛／N 分鐘前／N 小時前／N 天前」，超過一週顯示日期（通知用） */
export function relativeServerTime(value: string, now = dayjs()): string {
  const t = dayjs.utc(value).local();
  const minutes = now.diff(t, 'minute');
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = now.diff(t, 'hour');
  if (hours < 24) return `${hours} 小時前`;
  const days = now.diff(t, 'day');
  if (days < 7) return `${days} 天前`;
  return t.format(t.year() === now.year() ? 'M/D HH:mm' : 'YYYY/M/D');
}

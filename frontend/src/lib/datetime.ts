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

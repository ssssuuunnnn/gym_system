import type { Dayjs } from 'dayjs';

/**
 * 「加入行事曆」：產生 Google 日曆的新增活動連結（不需 OAuth，會員自己按「儲存」）。
 * 預約時間是店家當地時間，所以用不帶時區的當地時間 + `ctz` 告訴 Google 是哪個時區，
 * 會員手機設定成別的時區也不會差幾小時。
 */
export interface CalendarEvent {
  title: string;
  /** 店家當地的開始／結束時間（dayjs 物件，只取年月日時分） */
  start: Dayjs;
  end: Dayjs;
  /** 店家時區（IANA，例如 Asia/Taipei） */
  timezone: string;
  details?: string;
  location?: string;
}

const LOCAL_FORMAT = 'YYYYMMDDTHHmmss';

export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${event.start.format(LOCAL_FORMAT)}/${event.end.format(LOCAL_FORMAT)}`,
    ctz: event.timezone,
  });
  if (event.details) params.set('details', event.details);
  if (event.location) params.set('location', event.location);
  // LINE 內建瀏覽器開 Google 日曆通常沒登入，加這個參數讓 LINE 改用手機預設瀏覽器開啟
  if (isLineInAppBrowser()) params.set('openExternalBrowser', '1');
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function isLineInAppBrowser(): boolean {
  return typeof navigator !== 'undefined' && /\bLine\//i.test(navigator.userAgent);
}

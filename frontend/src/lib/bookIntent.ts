import dayjs from 'dayjs';
import { isoWeekday } from './availability';
import { weekdayShort } from './weekday';

/**
 * 「想預約的那堂課」：會員在預約時因為沒有可用方案而去購買，記下這堂課；
 * 櫃台確認收款後（LINE 通知的「去預約」或再進預約頁）直接回到這堂課的確認面板。
 * 只存在這台裝置的 localStorage（讀寫失敗時當作沒有），14 天後失效。
 */
export type BookIntent =
  | {
      kind: 'group';
      courseId: number;
      courseName: string;
      /** YYYY-MM-DD */
      date: string;
      startMinute: number;
      savedAt: number;
    }
  | {
      kind: 'private';
      coachId: number | null;
      coachName: string | null;
      date: string;
      hour: number;
      savedAt: number;
    };

/** 存入時不需要 savedAt（逐一處理聯集的每種） */
export type BookIntentInput = BookIntent extends infer T ? (T extends BookIntent ? Omit<T, 'savedAt'> : never) : never;

const KEY = 'bookIntent';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function saveBookIntent(intent: BookIntentInput): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...intent, savedAt: Date.now() }));
  } catch {
    // 無痕模式等情況存不了，就不記
  }
}

export function loadBookIntent(): BookIntent | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw) as BookIntent;
    if (!intent.savedAt || Date.now() - intent.savedAt > MAX_AGE_MS) {
      clearBookIntent();
      return null;
    }
    return intent;
  } catch {
    return null;
  }
}

export function clearBookIntent(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // 忽略
  }
}

/** 給畫面顯示的一行說明，例如「11/2（日）19:00 飛輪燃脂」 */
export function bookIntentLabel(intent: BookIntent): string {
  const d = dayjs(intent.date);
  const day = `${d.format('M/D')}（${weekdayShort(isoWeekday(d))}）`;
  if (intent.kind === 'group') {
    return `${day} ${d.startOf('day').add(intent.startMinute, 'minute').format('HH:mm')} ${intent.courseName}`;
  }
  return `${day} ${String(intent.hour).padStart(2, '0')}:00 私人課${intent.coachName ? `（${intent.coachName}）` : ''}`;
}

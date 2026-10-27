/**
 * LIFF 入口的網址對應（見 docs/adr/0005-gym-line-oa.md）。
 * 底部選單開 https://liff.line.me/<LIFF ID>/<頁面>，LINE 轉到 /liff/<頁面>（或先帶 ?liff.state=/<頁面>）。
 */
const TARGETS: Record<string, string> = {
  book: '/member/book',
  bookings: '/member/bookings',
  purchase: '/member/purchase',
  products: '/member/products',
  me: '/member/me',
};
export const DEFAULT_TARGET = '/member/dashboard';

/** 從目前網址算出登入後要去的會員頁面 */
export function liffTarget(pathname: string, search: string): string {
  const state = new URLSearchParams(search).get('liff.state');
  const raw = state ?? pathname.replace(/^\/liff\/?/, '');
  const key = raw.replace(/^\//, '').split(/[/?#]/)[0];
  return TARGETS[key] ?? DEFAULT_TARGET;
}

/**
 * 本機開發用：瀏覽器沒有 LINE 登入時，可在 localStorage 設定 `liffMockIdToken`，略過 LIFF SDK。
 * 只在開發模式有效，正式版不會讀取。
 */
export function devMockIdToken(): string | null {
  if (!import.meta.env.DEV) return null;
  try {
    return window.localStorage.getItem('liffMockIdToken');
  } catch {
    return null;
  }
}

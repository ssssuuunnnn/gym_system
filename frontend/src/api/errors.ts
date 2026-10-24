import axios from 'axios';

/** 取出後端錯誤訊息：400 的 detail 字串；422 取第一個欄位錯誤（去掉 Pydantic 的「Value error, 」前綴）。 */
export function apiErrorMessage(error: unknown, fallback = '操作失敗，請稍後再試'): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, '');
  }
  return fallback;
}

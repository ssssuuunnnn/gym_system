import axios from 'axios';
import { usePlatformAuthStore } from '../store/platformAuth';

/** 平台管理後台的 API 呼叫：帶平台管理員的 token（與健身房的 apiClient 分開）。 */
export const platformClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/platform`,
});

platformClient.interceptors.request.use((config) => {
  const token = usePlatformAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

platformClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      usePlatformAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

/** 取出後端錯誤訊息（400 的 detail 字串；422 取第一個欄位錯誤） */
export function apiErrorMessage(error: unknown, fallback = '操作失敗，請稍後再試'): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  }
  return fallback;
}

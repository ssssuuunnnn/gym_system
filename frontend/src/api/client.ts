import axios from 'axios';
import { useAuthStore } from '../store/auth';

/**
 * API 基底設定。對應「技術棧與系統架構」章節：前端透過 REST API 呼叫 FastAPI 後端，
 * 後端路由前綴為 /api/v1（見 backend/app/core/config.py 的 API_V1_PREFIX）。
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

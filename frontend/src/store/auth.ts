import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 全域登入狀態。role / isCoach 對應後端 JWT payload，用於：
 * - 路由守衛（未登入或角色不符時導向登入頁）
 * - 側邊欄依角色顯示 6 大類（管理員）／3 大類（會員）導覽
 * - 送出預約申請畫面依身份顯示不同商品選項（學員 vs 場租教練）
 * - 加購臨時加人 (3b) 僅教練身份可見
 *
 * 持久化到 localStorage，重新整理頁面後登入狀態不會遺失。
 */
export type Role = 'admin' | 'member';

interface AuthState {
  token: string | null;
  role: Role | null;
  isCoach: boolean;
  username: string | null;
  login: (params: { token: string; role: Role; isCoach: boolean; username: string }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      isCoach: false,
      username: null,
      login: ({ token, role, isCoach, username }) => set({ token, role, isCoach, username }),
      logout: () => set({ token: null, role: null, isCoach: false, username: null }),
    }),
    { name: 'auth-storage' },
  ),
);

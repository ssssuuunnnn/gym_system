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
  /** 管理員曾重設密碼並要求會員自行修改：完成修改前僅能停留在修改密碼頁 */
  mustChangePassword: boolean;
  /** 在健身房的 LINE 官方帳號裡（LIFF）登入：隱藏登出、修改密碼（見 docs/adr/0005-gym-line-oa.md） */
  inLine: boolean;
  login: (params: {
    token: string;
    role: Role;
    isCoach: boolean;
    username: string;
    mustChangePassword: boolean;
    inLine?: boolean;
  }) => void;
  clearMustChangePassword: () => void;
  logout: () => void;
}

/**
 * 從 JWT payload 的 `sub` claim 取出使用者 id（不驗證簽章，僅供前端顯示/預填用途，
 * 例如送出預約申請時需要帶入自己的 member_id）。
 */
export function decodeUserId(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.sub ? Number(payload.sub) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      isCoach: false,
      username: null,
      mustChangePassword: false,
      inLine: false,
      login: ({ token, role, isCoach, username, mustChangePassword, inLine = false }) =>
        set({ token, role, isCoach, username, mustChangePassword, inLine }),
      clearMustChangePassword: () => set({ mustChangePassword: false }),
      logout: () =>
        set({ token: null, role: null, isCoach: false, username: null, mustChangePassword: false, inLine: false }),
    }),
    { name: 'auth-storage' },
  ),
);

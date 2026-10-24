import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 平台管理員的登入狀態，與健身房帳號（store/auth.ts）完全分開。
 * 平台後台在自己的網域（platform.<主網域>），localStorage 本來就與各家健身房隔開；另取名稱以免混用。
 */
interface PlatformAuthState {
  token: string | null;
  username: string | null;
  login: (params: { token: string; username: string }) => void;
  logout: () => void;
}

export const usePlatformAuthStore = create<PlatformAuthState>()(
  persist(
    (set) => ({
      token: null,
      username: null,
      login: ({ token, username }) => set({ token, username }),
      logout: () => set({ token: null, username: null }),
    }),
    { name: 'platform-auth-storage' },
  ),
);

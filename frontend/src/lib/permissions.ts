import { useQuery } from '@tanstack/react-query';
import { getMe } from '../api/users';
import type { PermissionCode } from '../api/staff';

/**
 * 登入者的後台功能權限（ADR 0008）：讀 /auth/me 的 staff，和會員「我的」共用 ['me'] 快取。
 * 只用來決定側欄與頁面要不要顯示；真正的檢查在後端每支 API。
 */
export function usePermissions() {
  const query = useQuery({ queryKey: ['me'], queryFn: getMe, staleTime: 30_000 });
  const staff = query.data?.staff ?? null;
  const allowed = new Set<PermissionCode>(staff?.permissions ?? []);
  return {
    isLoading: query.isLoading,
    level: staff?.level ?? null,
    isOwner: staff?.level === '主要管理者',
    can: (code: PermissionCode) => allowed.has(code),
  };
}

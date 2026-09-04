import { apiClient } from './client';

export interface Member {
  id: number;
  username: string;
  role: 'admin' | 'member';
  created_at: string;
  last_login_at: string | null;
  is_blacklisted: boolean;
  is_coach: boolean;
}

export async function listMembers() {
  const { data } = await apiClient.get<Member[]>('/users');
  return data;
}

export async function getMember(userId: number) {
  const { data } = await apiClient.get<Member>(`/users/${userId}`);
  return data;
}

/** 對應「會員詳情」會員資料卡：目前僅可變更帳號。 */
export async function updateMemberUsername(userId: number, username: string) {
  const { data } = await apiClient.put<Member>(`/users/${userId}`, { username });
  return data;
}

/** 對應「會員詳情」黑名單狀態卡。 */
export async function setMemberBlacklist(userId: number, isBlacklisted: boolean) {
  const { data } = await apiClient.put<Member>(`/users/${userId}/blacklist`, {
    is_blacklisted: isBlacklisted,
  });
  return data;
}

/** 對應「會員詳情」登入密碼卡的「由管理員設定新密碼」。 */
export async function resetMemberPassword(
  userId: number,
  payload: { new_password: string; must_change_password: boolean },
) {
  await apiClient.post(`/users/${userId}/reset-password`, payload);
}

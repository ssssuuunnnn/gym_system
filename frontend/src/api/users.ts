import { apiClient } from './client';

export interface Member {
  id: number;
  username: string;
  role: 'admin' | 'member';
  created_at: string;
  last_login_at: string | null;
  is_blacklisted: boolean;
  is_coach: boolean;
  /** 姓名、手機（在 LINE 加入會員時填寫，管理員可修改） */
  display_name: string | null;
  phone: string | null;
  /** 只用 LINE 加入、還沒有密碼的會員為 false */
  has_password: boolean;
  line_linked: boolean;
  line_display_name: string | null;
  line_linked_at: string | null;
  /** 會員是否接收健身房官方帳號的通知 */
  line_notify: boolean;
  /** 同意接收優惠與活動訊息（行銷，和服務通知分開） */
  marketing_consent: boolean;
  marketing_consent_at: string | null;
}

export async function listMembers() {
  const { data } = await apiClient.get<Member[]>('/users');
  return data;
}

export async function getMember(userId: number) {
  const { data } = await apiClient.get<Member>(`/users/${userId}`);
  return data;
}

/** 對應「會員詳情」會員資料卡：帳號、姓名、手機（只送有變更的欄位）。 */
export async function updateMember(
  userId: number,
  payload: { username?: string; display_name?: string | null; phone?: string | null },
) {
  const { data } = await apiClient.put<Member>(`/users/${userId}`, payload);
  return data;
}

/** 目前登入的帳號（含 LINE 綁定狀態）。 */
export async function getMe() {
  const { data } = await apiClient.get<Member>('/auth/me');
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

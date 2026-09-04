import { apiClient } from './client';

export async function login(username: string, password: string) {
  const form = new URLSearchParams();
  form.set('username', username);
  form.set('password', password);
  const { data } = await apiClient.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data as {
    access_token: string;
    role: 'admin' | 'member';
    is_coach: boolean;
    must_change_password: boolean;
  };
}

export async function register(username: string, password: string) {
  const { data } = await apiClient.post('/auth/register', { username, password });
  return data;
}

/** 對應「會員修改密碼頁」：驗證目前密碼後設定新密碼。 */
export async function changePassword(currentPassword: string, newPassword: string) {
  await apiClient.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

import { apiClient } from './client';

export async function login(username: string, password: string) {
  const form = new URLSearchParams();
  form.set('username', username);
  form.set('password', password);
  const { data } = await apiClient.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data as { access_token: string; role: 'admin' | 'member'; is_coach: boolean };
}

export async function register(username: string, password: string) {
  const { data } = await apiClient.post('/auth/register', { username, password });
  return data;
}

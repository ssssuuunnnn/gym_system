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

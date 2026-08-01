import { apiClient } from './client';

export interface Coach {
  id: number;
  user_id: number;
  name: string;
  phone: string;
  created_at: string;
}

export async function listCoaches() {
  const { data } = await apiClient.get<Coach[]>('/coaches');
  return data;
}

export async function deleteCoach(id: number) {
  await apiClient.delete(`/coaches/${id}`);
}

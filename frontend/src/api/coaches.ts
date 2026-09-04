import { apiClient } from './client';

export interface Coach {
  id: number;
  user_id: number;
  name: string;
  alias: string | null;
  line_name: string | null;
  phone: string;
  bank_code: string | null;
  bank_account: string | null;
  specialty: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface CoachPayload {
  user_id: number;
  name: string;
  alias?: string | null;
  line_name?: string | null;
  phone: string;
  bank_code?: string | null;
  bank_account?: string | null;
  specialty?: string | null;
  photo_url?: string | null;
}

export async function listCoaches() {
  const { data } = await apiClient.get<Coach[]>('/coaches');
  return data;
}

export async function createCoach(payload: CoachPayload) {
  const { data } = await apiClient.post<Coach>('/coaches', payload);
  return data;
}

export async function updateCoach(id: number, payload: Partial<CoachPayload>) {
  const { data } = await apiClient.put<Coach>(`/coaches/${id}`, payload);
  return data;
}

export async function deleteCoach(id: number) {
  await apiClient.delete(`/coaches/${id}`);
}

/** 對應「新增教練」教練照片上傳，回傳可存入 photo_url 的相對網址。 */
export async function uploadCoachPhoto(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<{ url: string }>('/coaches/upload-photo', form);
  return data.url;
}

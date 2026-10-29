import { apiClient } from './client';

export type CoachType = '私人教練' | '團體課程教練' | '場租教練';
export const COACH_TYPES: CoachType[] = ['私人教練', '團體課程教練', '場租教練'];

/**
 * 非管理員讀取時，phone／line_name／bank_code／bank_account／session_rate 一律為 null（後端遮蔽）。
 */
export interface Coach {
  id: number;
  user_id: number;
  name: string;
  alias: string | null;
  line_name: string | null;
  phone: string | null;
  bank_code: string | null;
  bank_account: string | null;
  specialty: string | null;
  photo_url: string | null;
  /** 私人課每堂鐘點費（僅管理員可見） */
  session_rate: number | null;
  /** 教練類型（可複選；場租教練不與其他類型並存） */
  coach_types: CoachType[];
  /** 授課分店（至少一間） */
  branch_ids: number[];
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
  session_rate?: number;
  coach_types?: CoachType[];
  branch_ids?: number[];
}

/** 教練本人的教練資料（含類型） */
export async function getMyCoachProfile() {
  const { data } = await apiClient.get<Coach>('/coaches/me');
  return data;
}

/** 公司要付鐘點的教練（私人教練或團體課程教練） */
export function isPayableCoach(types: CoachType[] | undefined) {
  return !!types && (types.includes('私人教練') || types.includes('團體課程教練'));
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

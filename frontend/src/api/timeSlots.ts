import { apiClient } from './client';

export interface TimeSlot {
  id: number;
  /** 公休各分店獨立 */
  branch_id: number;
  slot_date: string; // YYYY-MM-DD
  start_hour: number;
  is_open: boolean;
  updated_by: number | null;
  updated_at: string;
}

/** branchId 省略＝全部分店 */
export async function listTimeSlots(branchId?: number | null) {
  const { data } = await apiClient.get<TimeSlot[]>('/time-slots', {
    params: branchId != null ? { branch_id: branchId } : undefined,
  });
  return data;
}

export async function upsertTimeSlot(payload: {
  slot_date: string;
  start_hour: number;
  is_open: boolean;
  branch_id?: number | null;
}) {
  const { data } = await apiClient.put<TimeSlot>('/time-slots', payload);
  return data;
}

import { apiClient } from './client';

export interface TimeSlot {
  id: number;
  slot_date: string; // YYYY-MM-DD
  start_hour: number;
  is_open: boolean;
  updated_by: number | null;
  updated_at: string;
}

export async function listTimeSlots() {
  const { data } = await apiClient.get<TimeSlot[]>('/time-slots');
  return data;
}

export async function upsertTimeSlot(payload: { slot_date: string; start_hour: number; is_open: boolean }) {
  const { data } = await apiClient.put<TimeSlot>('/time-slots', payload);
  return data;
}

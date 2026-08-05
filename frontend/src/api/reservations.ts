import { apiClient } from './client';

export type ReservationStatus = '待確認' | '已確認' | '已拒絕' | '已取消';
export type ReservationSource = 'member_submitted' | 'admin_created';

export interface Reservation {
  id: number;
  member_id: number;
  coach_id: number | null;
  course_id: number | null;
  product_id: number;
  purchase_id: number | null;
  booking_date: string;
  start_hour: number;
  people_count: number;
  status: ReservationStatus;
  source: ReservationSource;
  notes: string | null;
  created_at: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  cancelled_at: string | null;
}

export async function listReservations(memberId?: number) {
  const { data } = await apiClient.get<Reservation[]>('/reservations', {
    params: memberId !== undefined ? { member_id: memberId } : undefined,
  });
  return data;
}

export async function reviewReservation(id: number, status: ReservationStatus) {
  const { data } = await apiClient.post<Reservation>(`/reservations/${id}/review`, { status });
  return data;
}

export async function cancelReservation(id: number) {
  const { data } = await apiClient.post<Reservation>(`/reservations/${id}/cancel`);
  return data;
}

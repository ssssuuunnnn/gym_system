import { apiClient } from './client';

export type ReservationStatus = '待確認' | '已確認' | '已拒絕' | '已取消';
export type ReservationSource = 'member_submitted' | 'admin_created';
export type Attendance = '已出席' | '未到';

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
  /** 已確認的預約在取消期限內取消（預設不退堂） */
  late_cancel: boolean;
  /** 出席狀態；null＝尚未簽到 */
  attendance: Attendance | null;
  checked_in_at: string | null;
  checked_in_by: number | null;
}

export async function listReservations(memberId?: number) {
  const { data } = await apiClient.get<Reservation[]>('/reservations', {
    params: memberId !== undefined ? { member_id: memberId } : undefined,
  });
  return data;
}

export interface ReservationCreatePayload {
  member_id: number;
  coach_id?: number | null;
  course_id?: number | null;
  product_id: number;
  purchase_id?: number | null;
  booking_date: string;
  start_hour: number;
  people_count: number;
  notes?: string | null;
}

export async function createReservation(payload: ReservationCreatePayload, asAdmin: boolean) {
  const { data } = await apiClient.post<Reservation>('/reservations', payload, {
    params: { as_admin: asAdmin },
  });
  return data;
}

export async function reviewReservation(id: number, status: ReservationStatus) {
  const { data } = await apiClient.post<Reservation>(`/reservations/${id}/review`, { status });
  return data;
}

/**
 * 取消預約。refund 僅管理員可指定（覆寫取消期限規則）；省略時由後端依規則決定是否退堂。
 */
export async function cancelReservation(id: number, refund?: boolean) {
  const { data } = await apiClient.post<Reservation>(
    `/reservations/${id}/cancel`,
    refund === undefined ? undefined : { refund },
  );
  return data;
}

/** 簽到／標記未到：學員只能在時間窗內為自己標記已出席；教練／管理員可標記已出席或未到 */
export async function markAttendance(id: number, attendance: Attendance) {
  const { data } = await apiClient.post<Reservation>(`/reservations/${id}/attendance`, { attendance });
  return data;
}

/** 教練簽到用：由此教練帶的已確認預約（指定此教練，或其授課的團體課程） */
export interface CoachingReservation extends Reservation {
  /** 教練無法讀取會員清單，後端直接附上學員帳號 */
  member_username: string;
}

export async function listCoachingReservations() {
  const { data } = await apiClient.get<CoachingReservation[]>('/reservations/coaching');
  return data;
}

export interface ReservationUpdatePayload {
  booking_date?: string;
  start_hour?: number;
  people_count?: number;
  notes?: string | null;
}

export async function updateReservation(id: number, payload: ReservationUpdatePayload) {
  const { data } = await apiClient.put<Reservation>(`/reservations/${id}`, payload);
  return data;
}

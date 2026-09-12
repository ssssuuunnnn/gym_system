import { apiClient } from './client';

export type CheckinMethod = 'kiosk_self' | 'admin_manual';

export interface CheckinRosterEntry {
  id: number;
  member_id: number;
  username: string;
  people_count: number;
  status: string;
  checked_in_at: string | null;
  checked_in_method: CheckinMethod | null;
}

export interface CheckinSessionSummary {
  course_id: number;
  course_name: string;
  coach_name: string;
  booking_date: string;
  start_hour: number;
  duration_minutes: number;
  max_capacity: number;
}

export interface CheckinRoster {
  session: CheckinSessionSummary;
  entries: CheckinRosterEntry[];
  checked_in_count: number;
  total_count: number;
}

export interface SessionKey {
  courseId: number;
  bookingDate: string;
  startHour: number;
}

/** 課程報到（管理員）：名單與報到狀態。 */
export async function getRoster({ courseId, bookingDate, startHour }: SessionKey) {
  const { data } = await apiClient.get<CheckinRoster>('/reservations/roster', {
    params: { course_id: courseId, booking_date: bookingDate, start_hour: startHour },
  });
  return data;
}

export async function checkIn(reservationId: number) {
  const { data } = await apiClient.post(`/reservations/${reservationId}/check-in`);
  return data;
}

export async function undoCheckIn(reservationId: number) {
  const { data } = await apiClient.post(`/reservations/${reservationId}/check-in/undo`);
  return data;
}

/** 第二螢幕「名單看板」用：免登入，僅回傳姓名（username）與報到狀態。 */
export interface PublicCheckinEntry {
  reservation_id: number;
  display_name: string;
  checked_in: boolean;
  checked_in_at: string | null;
}

export interface PublicCheckinSession {
  course_id: number;
  course_name: string;
  booking_date: string;
  start_hour: number;
}

export interface PublicCheckinRoster {
  session: PublicCheckinSession;
  entries: PublicCheckinEntry[];
  checked_in_count: number;
  total_count: number;
}

export async function getPublicRoster({ courseId, bookingDate, startHour }: SessionKey) {
  const { data } = await apiClient.get<PublicCheckinRoster>('/public/checkin/roster', {
    params: { course_id: courseId, booking_date: bookingDate, start_hour: startHour },
  });
  return data;
}

export async function publicCheckIn(
  { courseId, bookingDate, startHour }: SessionKey,
  reservationId: number,
) {
  const { data } = await apiClient.post('/public/checkin/check-in', {
    course_id: courseId,
    booking_date: bookingDate,
    start_hour: startHour,
    reservation_id: reservationId,
  });
  return data;
}

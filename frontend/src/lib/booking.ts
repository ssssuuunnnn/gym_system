import dayjs, { type Dayjs } from 'dayjs';
import type { Reservation } from '../api/reservations';

/**
 * 預約時間規則的前端版本，只用來決定按鈕顯示與提示文字；實際規則以後端
 * （backend/app/services/booking_rules.py）為準，兩邊的常數要一致。
 * 預約的 booking_date + start_hour 是工作室當地時間。
 */
export const CHECK_IN_OPENS_BEFORE_MINUTES = 30;
export const DEFAULT_DURATION_MINUTES = 60;

export function classStart(reservation: Pick<Reservation, 'booking_date' | 'start_hour'>): Dayjs {
  return dayjs(reservation.booking_date).hour(reservation.start_hour).minute(0).second(0);
}

export function hasStarted(reservation: Reservation, now: Dayjs = dayjs()): boolean {
  return !now.isBefore(classStart(reservation));
}

/** 已確認的預約在取消期限內取消算晚取消（不退堂）；待確認的不算，期限 0 表示不限制 */
export function isLateCancel(reservation: Reservation, deadlineHours: number | undefined, now: Dayjs = dayjs()) {
  if (reservation.status !== '已確認' || !deadlineHours) return false;
  return !now.isBefore(classStart(reservation).subtract(deadlineHours, 'hour'));
}

/** 學員自行簽到的時間窗：開課前 30 分鐘到下課 */
export function selfCheckInOpen(reservation: Reservation, durationMinutes?: number, now: Dayjs = dayjs()) {
  const start = classStart(reservation);
  const end = start.add(durationMinutes ?? DEFAULT_DURATION_MINUTES, 'minute');
  return !now.isBefore(start.subtract(CHECK_IN_OPENS_BEFORE_MINUTES, 'minute')) && !now.isAfter(end);
}

/** 教練／管理員可開始標記的時間：開課前 30 分鐘起（之後不限，可補登） */
export function staffCheckInOpen(reservation: Reservation, now: Dayjs = dayjs()) {
  return !now.isBefore(classStart(reservation).subtract(CHECK_IN_OPENS_BEFORE_MINUTES, 'minute'));
}

import type { UpcomingCourseSession } from '../../../../api/courses';
import type { SessionKey } from '../../../../api/checkin';

/** 選擇課程下拉的 option value ⇄ SessionKey 互轉（單一字串鍵，供 antd Select 使用）。 */
export function sessionOptionValue(s: UpcomingCourseSession): string {
  return `${s.course_id}|${s.session_date}|${Math.floor(s.start_minute / 60)}`;
}

export function parseSessionOptionValue(value: string): SessionKey {
  const [courseId, bookingDate, startHour] = value.split('|');
  return { courseId: Number(courseId), bookingDate, startHour: Number(startHour) };
}

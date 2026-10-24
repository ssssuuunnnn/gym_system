import { useQuery } from '@tanstack/react-query';
import { listCourses } from '../api/courses';
import { listProducts } from '../api/products';
import { listCoaches } from '../api/coaches';
import type { Reservation } from '../api/reservations';
import { DEFAULT_DURATION_MINUTES } from './booking';

export interface ReservationInfo {
  /** 團體課顯示課程名稱，私人課顯示商品名稱 */
  title: string;
  /** 團體課＝課程的授課教練；私人課＝預約指定的教練 */
  coachName: string | null;
  durationMinutes: number;
  isGroup: boolean;
}

/**
 * 前台顯示預約時需要的名稱查詢（課程、商品、教練），會員首頁與教練今日課表共用。
 * 三個清單都對所有登入者開放讀取（教練私人欄位已由後端遮蔽）。
 */
export function useBookingLookups() {
  const courses = useQuery({ queryKey: ['courses'], queryFn: listCourses });
  const products = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const coaches = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });

  const courseById = new Map((courses.data ?? []).map((c) => [c.id, c]));
  const productById = new Map((products.data ?? []).map((p) => [p.id, p]));
  const coachById = new Map((coaches.data ?? []).map((c) => [c.id, c]));

  const describe = (r: Reservation): ReservationInfo => {
    const course = r.course_id != null ? courseById.get(r.course_id) : undefined;
    const coachId = course?.coach_id ?? r.coach_id;
    const coach = coachId != null ? coachById.get(coachId) : undefined;
    return {
      title: course?.name ?? productById.get(r.product_id)?.name ?? '課程',
      coachName: coach ? coach.alias || coach.name : null,
      durationMinutes: course?.duration_minutes ?? DEFAULT_DURATION_MINUTES,
      isGroup: r.course_id != null,
    };
  };

  return {
    describe,
    courseById,
    productById,
    coachById,
    isLoading: courses.isLoading || products.isLoading || coaches.isLoading,
  };
}

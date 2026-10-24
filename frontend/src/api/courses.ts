import { apiClient } from './client';

export type CourseStatus = '上架' | '下架' | '草稿';

export const COURSE_STATUSES: CourseStatus[] = ['上架', '下架', '草稿'];

/** 開課期間結束方式 */
export type ScheduleEndMode = '週數' | '結束日';
/** 課堂來源：排程展開 / 單次加開 */
export type SessionSource = '排程' | '加開';

export interface CourseSession {
  id?: number;
  position: number;
  session_date: string;
  start_minute: number;
  duration_minutes: number;
  source: SessionSource;
  /** 停課（保留紀錄，不計入課堂數） */
  is_cancelled: boolean;
}

export interface Course {
  id: number;
  name: string;
  code: string | null;
  coach_id: number;
  /** 最小的上課星期（1–7），列表摘要用 */
  day_of_week: number | null;
  start_hour: number | null;
  duration_minutes: number;
  min_capacity: number;
  max_capacity: number;
  /** 每堂教練費（團體課程教練鐘點用）；非管理員讀取時為 null */
  coach_fee: number | null;
  session_count: number;
  description: string | null;
  cover_image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  end_mode: ScheduleEndMode | null;
  week_count: number | null;
  /** 上課星期（ISO 1–7），可多個 */
  weekdays: number[];
  status: CourseStatus;
  is_archived: boolean;
  archived_at: string | null;
  archived_by_name: string | null;
  /** 單堂尖峰報名人數 */
  enrolled_count: number;
  created_at: string;
  updated_at: string;
  updated_by_name: string | null;
}

export interface CourseDetail extends Course {
  sessions: CourseSession[];
}

/** 對應「教練課程」頁：某教練所有未封存課程的單堂課堂（含所屬課程資訊）。 */
export interface CoachCourseSession {
  course_id: number;
  course_name: string;
  course_code: string | null;
  course_status: CourseStatus;
  session_date: string;
  start_minute: number;
  duration_minutes: number;
  source: SessionSource;
  is_cancelled: boolean;
}

export interface CoursePayload {
  name: string;
  coach_id: number;
  duration_minutes: number;
  min_capacity: number;
  max_capacity: number;
  coach_fee: number;
  description?: string | null;
  cover_image_url?: string | null;
  status: CourseStatus;
  weekdays: number[];
  start_hour: number | null;
  start_date: string | null;
  end_mode: ScheduleEndMode | null;
  end_date: string | null;
  week_count: number | null;
  sessions: CourseSession[];
}

export async function listCourses() {
  const { data } = await apiClient.get<Course[]>('/courses');
  return data;
}

/** 團體課程管理列表：僅未封存課程。 */
export async function listActiveCourses() {
  const { data } = await apiClient.get<Course[]>('/courses', { params: { archived: false } });
  return data;
}

/** 封存課程列表：僅已封存課程。 */
export async function listArchivedCourses() {
  const { data } = await apiClient.get<Course[]>('/courses', { params: { archived: true } });
  return data;
}

/** 教練課程頁：某教練所有未封存課程的逐堂課堂。 */
export async function listCoachCourseSessions(coachId: number) {
  const { data } = await apiClient.get<CoachCourseSession[]>('/courses/coach-sessions', {
    params: { coach_id: coachId },
  });
  return data;
}

export async function getCourse(id: number) {
  const { data } = await apiClient.get<CourseDetail>(`/courses/${id}`);
  return data;
}

export async function createCourse(payload: CoursePayload) {
  const { data } = await apiClient.post<CourseDetail>('/courses', payload);
  return data;
}

export async function updateCourse(id: number, payload: Partial<CoursePayload>) {
  const { data } = await apiClient.put<CourseDetail>(`/courses/${id}`, payload);
  return data;
}

export async function updateCourseStatus(id: number, status: CourseStatus) {
  const { data } = await apiClient.patch<Course>(`/courses/${id}/status`, { status });
  return data;
}

export async function archiveCourse(id: number) {
  const { data } = await apiClient.post<Course>(`/courses/${id}/archive`);
  return data;
}

export async function restoreCourse(id: number) {
  const { data } = await apiClient.post<Course>(`/courses/${id}/restore`);
  return data;
}

export async function deleteCourse(id: number) {
  await apiClient.delete(`/courses/${id}`);
}

/** 對應「新增／編輯團體課程」課程封面上傳，回傳可存入 cover_image_url 的相對網址。 */
export async function uploadCourseCover(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<{ url: string }>('/courses/upload-cover', form);
  return data.url;
}

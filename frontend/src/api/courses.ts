import { apiClient } from './client';

export type CourseStatus = '上架' | '下架' | '草稿';

export const COURSE_STATUSES: CourseStatus[] = ['上架', '下架', '草稿'];

export type ScheduleFrequency = '每週' | '隔週';
export type ScheduleEndMode = '連續' | '結束於';
export type SessionSource = '規則' | '單次加開';

export interface CourseScheduleRule {
  id?: number;
  /** 列順序，對應「規則 1 / 2…」（0 起算） */
  position: number;
  /** 規則起始日 YYYY-MM-DD */
  start_date: string;
  /** 開始時間，自午夜起算分鐘 */
  start_minute: number;
  frequency: ScheduleFrequency;
  end_mode: ScheduleEndMode;
  /** 連續週數（end_mode = 連續） */
  week_count: number | null;
  /** 結束日 YYYY-MM-DD（end_mode = 結束於） */
  end_date: string | null;
}

export interface CourseSession {
  id?: number;
  position: number;
  session_date: string;
  start_minute: number;
  duration_minutes: number;
  source: SessionSource;
  /** 來源規則序號（1 起算）；單次加開為 null */
  rule_position: number | null;
  adjusted: boolean;
  origin_date: string | null;
  origin_minute: number | null;
}

export interface Course {
  id: number;
  name: string;
  code: string | null;
  coach_id: number;
  day_of_week: number | null;
  start_hour: number | null;
  duration_minutes: number;
  min_capacity: number;
  max_capacity: number;
  session_count: number;
  description: string | null;
  cover_image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  status: CourseStatus;
  is_archived: boolean;
  archived_at: string | null;
  archived_by_name: string | null;
  enrolled_count: number;
  created_at: string;
  updated_at: string;
  updated_by_name: string | null;
}

export interface CourseDetail extends Course {
  rules: CourseScheduleRule[];
  sessions: CourseSession[];
}

export interface CoursePayload {
  name: string;
  coach_id: number;
  duration_minutes: number;
  min_capacity: number;
  max_capacity: number;
  description?: string | null;
  cover_image_url?: string | null;
  status: CourseStatus;
  rules: CourseScheduleRule[];
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

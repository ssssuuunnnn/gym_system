import { apiClient } from './client';

export type CourseStatus = '上架' | '下架' | '草稿';

export const COURSE_STATUSES: CourseStatus[] = ['上架', '下架', '草稿'];

export interface Course {
  id: number;
  name: string;
  code: string | null;
  coach_id: number;
  day_of_week: number;
  start_hour: number;
  duration_minutes: number;
  min_capacity: number;
  max_capacity: number;
  session_count: number;
  description: string | null;
  cover_image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  status: CourseStatus;
  enrolled_count: number;
  created_at: string;
  updated_at: string;
  updated_by_name: string | null;
}

export interface CoursePayload {
  name: string;
  coach_id: number;
  day_of_week: number;
  start_hour: number;
  duration_minutes: number;
  min_capacity: number;
  max_capacity: number;
  session_count: number;
  description?: string | null;
  cover_image_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status: CourseStatus;
}

export async function listCourses() {
  const { data } = await apiClient.get<Course[]>('/courses');
  return data;
}

export async function createCourse(payload: CoursePayload) {
  const { data } = await apiClient.post<Course>('/courses', payload);
  return data;
}

export async function updateCourse(id: number, payload: Partial<CoursePayload>) {
  const { data } = await apiClient.put<Course>(`/courses/${id}`, payload);
  return data;
}

export async function updateCourseStatus(id: number, status: CourseStatus) {
  const { data } = await apiClient.patch<Course>(`/courses/${id}/status`, { status });
  return data;
}

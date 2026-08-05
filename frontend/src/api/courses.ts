import { apiClient } from './client';

export interface Course {
  id: number;
  name: string;
  coach_id: number;
  day_of_week: number;
  start_hour: number;
  max_capacity: number;
  created_at: string;
}

export async function listCourses() {
  const { data } = await apiClient.get<Course[]>('/courses');
  return data;
}

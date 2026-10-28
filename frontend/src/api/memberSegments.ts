import { apiClient } from './client';

/** 會員名單（後端 routers/member_segments.py、ADR 0006） */
export type SegmentKind = '全部' | '團體課' | '私人課';
export type LineReach = '可發送' | '未綁定 LINE' | '未同意優惠訊息';

export interface SegmentFilters {
  /** 上課期間（YYYY-MM-DD）：這段期間內有「已出席」紀錄才算 */
  start: string;
  end: string;
  kind: SegmentKind;
  coach_id: number | null;
  /** 期間內至少出席幾次 */
  min_attended: number;
  /** 剩餘堂數（已付款方案加總）不超過；null＝不限 */
  max_remaining_hours: number | null;
  /** 最後一次上課距今至少幾天；null＝不限 */
  inactive_days: number | null;
}

export interface SegmentMember {
  id: number;
  name: string;
  username: string;
  phone: string | null;
  attended_count: number;
  last_attended: string;
  remaining_hours: number;
  reach: LineReach;
}

export interface SegmentResult {
  total: number;
  sendable: number;
  no_line: number;
  no_consent: number;
  members: SegmentMember[];
}

export interface LineAudience {
  id: number;
  name: string;
  audience_group_id: number;
  filters: SegmentFilters;
  member_count: number;
  created_by_name: string | null;
  created_at: string;
}

export async function previewSegment(filters: SegmentFilters) {
  const { data } = await apiClient.post<SegmentResult>('/member-segments/preview', filters);
  return data;
}

export async function createAudience(payload: { name: string; filters: SegmentFilters }) {
  const { data } = await apiClient.post<LineAudience>('/member-segments/audiences', payload);
  return data;
}

export async function listAudiences() {
  const { data } = await apiClient.get<LineAudience[]>('/member-segments/audiences');
  return data;
}

import { apiClient } from './client';

/** 會員標籤（後端 routers/member_tags.py、ADR 0012）：只在後台使用，會員看不到 */

/** 可選的標籤顏色（antd Tag 預設色，與後端 TagColor 一致） */
export const TAG_COLORS = [
  { value: 'blue', label: '藍' },
  { value: 'green', label: '綠' },
  { value: 'gold', label: '金' },
  { value: 'orange', label: '橘' },
  { value: 'red', label: '紅' },
  { value: 'magenta', label: '桃紅' },
  { value: 'purple', label: '紫' },
  { value: 'cyan', label: '青' },
  { value: 'geekblue', label: '靛' },
  { value: 'default', label: '灰' },
] as const;
export type TagColor = (typeof TAG_COLORS)[number]['value'];

export interface MemberTag {
  id: number;
  name: string;
  color: TagColor;
  member_count: number;
  /** 其中已綁定 LINE 且同意優惠訊息、收得到最新消息的人數 */
  sendable_count: number;
  created_at: string;
}

export interface MemberTagInput {
  name: string;
  color: TagColor;
}

export async function listMemberTags() {
  const { data } = await apiClient.get<MemberTag[]>('/member-tags');
  return data;
}

export async function createMemberTag(payload: MemberTagInput) {
  const { data } = await apiClient.post<MemberTag>('/member-tags', payload);
  return data;
}

export async function updateMemberTag(id: number, payload: MemberTagInput) {
  const { data } = await apiClient.put<MemberTag>(`/member-tags/${id}`, payload);
  return data;
}

export async function deleteMemberTag(id: number) {
  await apiClient.delete(`/member-tags/${id}`);
}

/** 幫一批會員加上標籤（已經有的略過） */
export async function addMembersToTag(id: number, userIds: number[]) {
  const { data } = await apiClient.post<MemberTag>(`/member-tags/${id}/members`, { user_ids: userIds });
  return data;
}

export async function removeMembersFromTag(id: number, userIds: number[]) {
  const { data } = await apiClient.post<MemberTag>(`/member-tags/${id}/members/remove`, { user_ids: userIds });
  return data;
}

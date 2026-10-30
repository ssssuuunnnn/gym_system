import { apiClient } from './client';

/** 對應 backend/app/schemas/inquiry.py */
export type InquiryStatus = '新詢問' | '聯絡中' | '已約體驗' | '已成為會員' | '未成交';
export const INQUIRY_STATUSES: InquiryStatus[] = ['新詢問', '聯絡中', '已約體驗', '已成為會員', '未成交'];

export interface InquiryNote {
  id: number;
  text: string;
  created_by_name: string;
  created_at: string;
}

export interface Inquiry {
  id: number;
  name: string;
  phone: string;
  line_id: string | null;
  interest: string | null;
  preferred_slot: string | null;
  message: string | null;
  status: InquiryStatus;
  member_user_id: number | null;
  created_at: string;
  updated_at: string;
  notes: InquiryNote[];
}

export async function listInquiries(status?: InquiryStatus) {
  const { data } = await apiClient.get<Inquiry[]>('/inquiries', { params: status ? { status } : {} });
  return data;
}

export async function getInquirySummary() {
  const { data } = await apiClient.get<{ new_count: number }>('/inquiries/summary');
  return data;
}

export async function updateInquiryStatus(id: number, status: InquiryStatus) {
  const { data } = await apiClient.patch<Inquiry>(`/inquiries/${id}`, { status });
  return data;
}

export async function addInquiryNote(id: number, text: string) {
  const { data } = await apiClient.post<Inquiry>(`/inquiries/${id}/notes`, { text });
  return data;
}

export async function convertInquiry(
  id: number,
  /** coupon_id：同時送一張體驗券（ADR 0010） */
  payload: { username: string; password: string; must_change_password: boolean; coupon_id?: number | null },
) {
  const { data } = await apiClient.post<Inquiry>(`/inquiries/${id}/convert`, payload);
  return data;
}

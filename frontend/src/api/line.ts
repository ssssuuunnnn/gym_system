import { apiClient } from './client';

/** 對應 backend/app/schemas/line.py（見 docs/adr/0004-line-notifications.md） */
export interface LineRecipient {
  id: number;
  display_name: string;
  notify_inquiry: boolean;
  notify_payment: boolean;
  notify_booking: boolean;
  bound_by_name: string | null;
  created_at: string;
}

export type LineNotifyFlag = 'notify_inquiry' | 'notify_payment' | 'notify_booking';

/** 三種通知（順序即後台欄位順序） */
export const LINE_EVENTS: { flag: LineNotifyFlag; label: string }[] = [
  { flag: 'notify_inquiry', label: '新的體驗課詢問' },
  { flag: 'notify_payment', label: '會員下單待收款' },
  { flag: 'notify_booking', label: '預約待審核' },
];

export interface LineSettings {
  configured: boolean;
  bot_name: string;
  add_friend_url: string | null;
  month_sent: number;
  monthly_cap: number;
  recipients: LineRecipient[];
}

export interface LineBindCode {
  id: number;
  code: string;
  expires_at: string;
  add_friend_url: string | null;
}

export interface LineBindStatus {
  status: 'waiting' | 'bound' | 'expired';
  recipient: LineRecipient | null;
}

export async function getLineSettings() {
  const { data } = await apiClient.get<LineSettings>('/line/settings');
  return data;
}

export async function createLineBindCode() {
  const { data } = await apiClient.post<LineBindCode>('/line/bind-codes');
  return data;
}

export async function getLineBindStatus(id: number) {
  const { data } = await apiClient.get<LineBindStatus>(`/line/bind-codes/${id}`);
  return data;
}

export async function updateLineRecipient(id: number, patch: Partial<Record<LineNotifyFlag, boolean>>) {
  const { data } = await apiClient.patch<LineRecipient>(`/line/recipients/${id}`, patch);
  return data;
}

export async function removeLineRecipient(id: number) {
  await apiClient.delete(`/line/recipients/${id}`);
}

export async function sendLineTest(id: number) {
  const { data } = await apiClient.post<{ queued: boolean }>(`/line/recipients/${id}/test`);
  return data;
}

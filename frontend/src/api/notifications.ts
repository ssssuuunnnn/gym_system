import { apiClient } from './client';

/** 後台鈴鐺通知（backend/app/routers/staff_notifications.py、ADR 0009） */
export type StaffNotificationKind = '新預約' | '會員取消預約' | '新訂單' | '新詢問';

export interface StaffNotification {
  id: number;
  kind: StaffNotificationKind;
  title: string;
  body: string;
  /** 點通知後前往的後台頁面 */
  link: string;
  read_at: string | null;
  created_at: string;
}

export interface StaffNotificationPage {
  items: StaffNotification[];
  has_more: boolean;
}

export interface StaffNotificationSummary {
  unread_count: number;
  latest_id: number;
  /** after_id 之後的新通知（新到舊，最多 10 筆） */
  new: StaffNotification[];
}

/** 收到某種通知時，對應頁面要重新讀取的資料 */
export const QUERY_KEYS_BY_KIND: Record<StaffNotificationKind, string[]> = {
  新預約: ['reservations'],
  會員取消預約: ['reservations'],
  新訂單: ['purchases'],
  新詢問: ['inquiries', 'inquiries-summary'],
};

export async function getNotificationSummary(afterId?: number): Promise<StaffNotificationSummary> {
  const { data } = await apiClient.get<StaffNotificationSummary>('/notifications/summary', {
    params: afterId === undefined ? {} : { after_id: afterId },
  });
  return data;
}

export async function listNotifications(params: {
  unreadOnly?: boolean;
  beforeId?: number;
  limit?: number;
}): Promise<StaffNotificationPage> {
  const { data } = await apiClient.get<StaffNotificationPage>('/notifications', {
    params: { unread_only: params.unreadOnly || undefined, before_id: params.beforeId, limit: params.limit },
  });
  return data;
}

export async function markNotificationRead(id: number): Promise<StaffNotification> {
  const { data } = await apiClient.post<StaffNotification>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post('/notifications/read-all');
}

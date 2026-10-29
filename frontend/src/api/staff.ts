import { apiClient } from './client';

/** 後台帳號與功能權限（後端 routers/staff.py、ADR 0008） */
export type PermissionCode =
  | 'dashboard'
  | 'reservations'
  | 'coaches'
  | 'payouts'
  | 'products'
  | 'purchases'
  | 'courses'
  | 'availability'
  | 'members'
  | 'segments'
  | 'website'
  | 'inquiries'
  | 'branches'
  | 'settings';

export type StaffLevel = '主要管理者' | '管理者' | '一般使用者';
/** 新增／修改時可選的身分（主要管理者只能用移交產生） */
export type AssignableLevel = Exclude<StaffLevel, '主要管理者'>;

export interface PermissionDef {
  code: PermissionCode;
  label: string;
  /** 含敏感資料（電話、匯款帳號、LINE 金鑰等） */
  sensitive: boolean;
  hint: string;
}

export interface RoleTemplate {
  key: string;
  label: string;
  codes: PermissionCode[];
}

export interface StaffMeta {
  permissions: PermissionDef[];
  templates: RoleTemplate[];
}

export interface StaffAccount {
  id: number;
  username: string;
  display_name: string | null;
  level: StaffLevel;
  /** 一般使用者勾選的功能；主要管理者、管理者為全部功能 */
  permissions: PermissionCode[];
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface StaffAuditLog {
  id: number;
  actor_name: string;
  target_name: string | null;
  action: string;
  detail: string;
  created_at: string;
}

export async function getStaffMeta() {
  const { data } = await apiClient.get<StaffMeta>('/staff/meta');
  return data;
}

export async function listStaff() {
  const { data } = await apiClient.get<StaffAccount[]>('/staff');
  return data;
}

export async function createStaff(payload: {
  username: string;
  display_name?: string | null;
  password: string;
  level: AssignableLevel;
  permissions: PermissionCode[];
}) {
  const { data } = await apiClient.post<StaffAccount>('/staff', payload);
  return data;
}

export async function updateStaff(
  id: number,
  payload: { display_name?: string | null; level?: AssignableLevel; permissions?: PermissionCode[] },
) {
  const { data } = await apiClient.put<StaffAccount>(`/staff/${id}`, payload);
  return data;
}

export async function setStaffActive(id: number, isActive: boolean) {
  const { data } = await apiClient.post<StaffAccount>(`/staff/${id}/status`, { is_active: isActive });
  return data;
}

export async function resetStaffPassword(id: number, newPassword: string) {
  const { data } = await apiClient.post<StaffAccount>(`/staff/${id}/reset-password`, { new_password: newPassword });
  return data;
}

export async function transferOwner(userId: number, password: string) {
  const { data } = await apiClient.post<StaffAccount>('/staff/transfer-owner', { user_id: userId, password });
  return data;
}

export async function listStaffLogs(limit = 50) {
  const { data } = await apiClient.get<StaffAuditLog[]>('/staff/logs', { params: { limit } });
  return data;
}

import { platformClient } from './platformClient';
import type { BusinessType } from './tenant';

export type { BusinessType };
/** 開通時可選的行業類型與說明 */
export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: '健身', label: '健身／運動' },
  { value: '美體', label: '美體（按摩、美容、SPA）' },
];

/** 對應 backend/app/schemas/platform.py */
export type TenantStatus = '試用' | '啟用' | '停用';

export const TENANT_STATUSES: TenantStatus[] = ['試用', '啟用', '停用'];

export interface TenantStats {
  member_count: number;
  admin_count: number;
  coach_count: number;
  reservations_this_month: number;
  last_login_at: string | null;
}

export interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  status: TenantStatus;
  timezone: string;
  /** 行業類型：決定這家店前後台的用詞與預設功能（ADR 0011） */
  business_type: BusinessType;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  /** LINE 通知每月上限（則） */
  line_monthly_cap: number;
  stats: TenantStats;
}

export interface TenantContactPayload {
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  note?: string | null;
}

export interface TenantCreatePayload extends TenantContactPayload {
  name: string;
  subdomain: string;
  timezone: string;
  status: TenantStatus;
  business_type: BusinessType;
  admin_username: string;
  admin_password: string;
  admin_must_change_password: boolean;
}

export interface TenantUpdatePayload extends TenantContactPayload {
  name?: string;
  timezone?: string;
  business_type?: BusinessType;
  line_monthly_cap?: number;
}

export interface SubdomainCheck {
  subdomain: string;
  available: boolean;
  reason: string | null;
}

export interface TenantAdmin {
  id: number;
  username: string;
  is_blacklisted: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  admin_username: string;
  tenant_id: number | null;
  tenant_name: string | null;
  action: string;
  action_label: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface PlatformAdmin {
  id: number;
  username: string;
  last_login_at: string | null;
  created_at: string;
}

export async function platformLogin(username: string, password: string) {
  const { data } = await platformClient.post<{ access_token: string; username: string }>('/auth/login', {
    username,
    password,
  });
  return data;
}

export async function getPlatformMe() {
  const { data } = await platformClient.get<PlatformAdmin>('/auth/me');
  return data;
}

export async function changePlatformPassword(current_password: string, new_password: string) {
  await platformClient.post('/auth/change-password', { current_password, new_password });
}

export async function listTenants(params: { status?: TenantStatus; q?: string } = {}) {
  const { data } = await platformClient.get<Tenant[]>('/tenants', { params });
  return data;
}

export async function getTenant(id: number) {
  const { data } = await platformClient.get<Tenant>(`/tenants/${id}`);
  return data;
}

export async function checkSubdomain(subdomain: string) {
  const { data } = await platformClient.get<SubdomainCheck>('/tenants/check-subdomain', { params: { subdomain } });
  return data;
}

export async function createTenant(payload: TenantCreatePayload) {
  const { data } = await platformClient.post<Tenant>('/tenants', payload);
  return data;
}

export async function updateTenant(id: number, payload: TenantUpdatePayload) {
  const { data } = await platformClient.put<Tenant>(`/tenants/${id}`, payload);
  return data;
}

export async function setTenantStatus(id: number, status: TenantStatus, reason?: string) {
  const { data } = await platformClient.post<Tenant>(`/tenants/${id}/status`, { status, reason });
  return data;
}

export async function listTenantAdmins(tenantId: number) {
  const { data } = await platformClient.get<TenantAdmin[]>(`/tenants/${tenantId}/admins`);
  return data;
}

export async function createTenantAdmin(
  tenantId: number,
  payload: { username: string; password: string; must_change_password: boolean },
) {
  const { data } = await platformClient.post<TenantAdmin>(`/tenants/${tenantId}/admins`, payload);
  return data;
}

export async function resetTenantAdminPassword(
  tenantId: number,
  userId: number,
  payload: { new_password: string; must_change_password: boolean },
) {
  const { data } = await platformClient.post<TenantAdmin>(
    `/tenants/${tenantId}/admins/${userId}/reset-password`,
    payload,
  );
  return data;
}

export async function listAuditLogs(params: { tenant_id?: number; limit?: number } = {}) {
  const { data } = await platformClient.get<AuditLog[]>('/audit-logs', { params });
  return data;
}

/* ---------- LINE 通知（docs/adr/0004-line-notifications.md） ---------- */

export type LineLogStatus = '待發送' | '重試中' | '成功' | '失敗' | '超過上限' | '未設定 LINE';

export interface LineGymUsage {
  tenant_id: number;
  name: string;
  subdomain: string;
  recipients: number;
  sent: number;
  cap: number;
  failed: number;
  skipped: number;
  retrying: number;
}

export interface LineUsageSummary {
  configured: boolean;
  bot_name: string;
  /** 平台 LINE 方案每月可發送則數 */
  plan_quota: number;
  /** YYYY-MM */
  month: string;
  sent: number;
  failed: number;
  skipped: number;
  recipients: number;
  gyms_with_recipients: number;
  gyms: LineGymUsage[];
}

export interface LineLog {
  id: number;
  tenant_id: number;
  tenant_name: string | null;
  event: string;
  status: LineLogStatus;
  recipient_count: number;
  sent_count: number;
  attempts: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export async function getLineUsage(month?: string) {
  const { data } = await platformClient.get<LineUsageSummary>('/line/summary', { params: { month } });
  return data;
}

export async function listLineLogs(params: { status?: LineLogStatus; limit?: number } = {}) {
  const { data } = await platformClient.get<LineLog[]>('/line/logs', { params });
  return data;
}

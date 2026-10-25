import { apiClient } from './client';

/** 對應 backend/app/schemas/line_oa.py（見 docs/adr/0005-gym-line-oa.md） */
export interface LineOaSettings {
  configured: boolean;
  enabled: boolean;
  login_channel_id: string | null;
  liff_id: string | null;
  /** 金鑰只回傳末四碼 */
  channel_secret_hint: string | null;
  access_token_hint: string | null;
  bot_basic_id: string | null;
  bot_name: string | null;
  bot_picture_url: string | null;
  rich_menu_set: boolean;
  verified_at: string | null;
  last_error: string | null;
  updated_by_name: string | null;
  updated_at: string | null;
  /** 要填到 LINE Developers 的值 */
  webhook_url: string;
  liff_endpoint_url: string;
  liff_url: string | null;
  add_friend_url: string | null;
  linked_members: number;
}

export interface LineOaPayload {
  /** 留空＝不變（第一次設定必填） */
  channel_secret?: string | null;
  access_token?: string | null;
  login_channel_id: string;
  liff_id: string;
}

export interface LineOaCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string | null;
  /** 必要項目全部通過才啟用；其他只提示 */
  required: boolean;
}

export interface LineOaVerifyResult {
  enabled: boolean;
  checks: LineOaCheck[];
  settings: LineOaSettings;
}

export interface LineOaPublic {
  enabled: boolean;
  liff_id: string | null;
  gym_name: string;
  bot_name: string | null;
  add_friend_url: string | null;
}

export interface LoginToken {
  access_token: string;
  role: 'admin' | 'member';
  is_coach: boolean;
  must_change_password: boolean;
}

export interface LineAuthResult {
  status: 'ok' | 'unlinked';
  token: LoginToken | null;
  link_token: string | null;
  line_display_name: string | null;
}

export async function getLineOa() {
  const { data } = await apiClient.get<LineOaSettings>('/line-oa');
  return data;
}

export async function saveLineOa(payload: LineOaPayload) {
  const { data } = await apiClient.put<LineOaSettings>('/line-oa', payload);
  return data;
}

export async function verifyLineOa() {
  const { data } = await apiClient.post<LineOaVerifyResult>('/line-oa/verify');
  return data;
}

export async function disableLineOa() {
  const { data } = await apiClient.post<LineOaSettings>('/line-oa/disable');
  return data;
}

export async function getLineOaPublic() {
  const { data } = await apiClient.get<LineOaPublic>('/line-oa/public');
  return data;
}

export async function lineLogin(idToken: string) {
  const { data } = await apiClient.post<LineAuthResult>('/auth/line', { id_token: idToken });
  return data;
}

export async function lineJoin(payload: { link_token: string; display_name: string; phone: string; consent: boolean }) {
  const { data } = await apiClient.post<LoginToken>('/auth/line/join', payload);
  return data;
}

export async function lineLink(payload: { link_token: string; username: string; password: string }) {
  const { data } = await apiClient.post<LoginToken>('/auth/line/link', payload);
  return data;
}

export async function lineUnlink() {
  await apiClient.post('/auth/line/unlink');
}

export async function unlinkMemberLine(userId: number) {
  await apiClient.post(`/users/${userId}/unlink-line`);
}

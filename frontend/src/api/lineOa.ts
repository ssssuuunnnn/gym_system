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
  /** 會員通知（第二階段） */
  notify_booking_result: boolean;
  notify_booking_cancel: boolean;
  notify_payment_confirmed: boolean;
  notify_class_reminder: boolean;
  /** 上課提醒：前一天幾點（健身房當地時間） */
  reminder_hour: number;
  /** 每月最多推播幾則；null＝不限制 */
  member_monthly_cap: number | null;
  member_sent_this_month: number;
}

export type MemberNotifyFlag =
  | 'notify_booking_result'
  | 'notify_booking_cancel'
  | 'notify_payment_confirmed'
  | 'notify_class_reminder';

/** 會員通知項目（順序即畫面順序） */
export const MEMBER_NOTIFY_ITEMS: { flag: MemberNotifyFlag; label: string; hint: string }[] = [
  { flag: 'notify_booking_result', label: '預約結果', hint: '審核通過／未成立，或櫃台幫會員預約' },
  { flag: 'notify_booking_cancel', label: '櫃台取消預約', hint: '含是否退回堂數；會員自己取消的不發' },
  { flag: 'notify_payment_confirmed', label: '已收到款項', hint: '確認收款後通知堂數已入帳' },
  { flag: 'notify_class_reminder', label: '上課提醒', hint: '前一天提醒明天的課，同一天多堂合成一則' },
];

export interface LineOaNotifyPayload {
  notify_booking_result?: boolean;
  notify_booking_cancel?: boolean;
  notify_payment_confirmed?: boolean;
  notify_class_reminder?: boolean;
  reminder_hour?: number;
  member_monthly_cap?: number | null;
}

export interface LineOaQuota {
  limited: boolean | null;
  limit: number | null;
  used: number | null;
  error: string | null;
}

export interface LineMemberMessage {
  id: number;
  event: string;
  member_name: string;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
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

export async function lineJoin(payload: {
  link_token: string;
  display_name: string;
  phone: string;
  consent: boolean;
  marketing_consent?: boolean;
}) {
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

export async function updateLineOaNotifications(payload: LineOaNotifyPayload) {
  const { data } = await apiClient.patch<LineOaSettings>('/line-oa/notifications', payload);
  return data;
}

export async function getLineOaQuota() {
  const { data } = await apiClient.get<LineOaQuota>('/line-oa/quota');
  return data;
}

export async function listLineMemberMessages(limit = 30) {
  const { data } = await apiClient.get<LineMemberMessage[]>('/line-oa/messages', { params: { limit } });
  return data;
}

/** 會員自己的 LINE 設定：服務通知（預約結果、上課提醒、收款）與優惠活動訊息分開，只帶要改的欄位 */
export async function setLinePreferences(payload: { line_notify?: boolean; marketing_consent?: boolean }) {
  const { data } = await apiClient.patch('/auth/line/preferences', payload);
  return data;
}

import { apiClient } from './client';

export interface Settings {
  id: number;
  company_name: string;
  short_name: string | null;
  logo_url: string | null;
  /** 取消期限：已確認的預約在開課前 N 小時內取消不退堂；0＝不限制 */
  cancel_deadline_hours: number;
  /** 付款方式說明（轉帳帳號等），會員下單後看到 */
  payment_instructions: string | null;
  updated_at: string;
}

export interface SettingsPayload {
  company_name?: string;
  short_name?: string | null;
  logo_url?: string | null;
  cancel_deadline_hours?: number;
  payment_instructions?: string | null;
}

export async function getSettings() {
  const { data } = await apiClient.get<Settings>('/system-settings');
  return data;
}

export async function updateSettings(payload: SettingsPayload) {
  const { data } = await apiClient.put<Settings>('/system-settings', payload);
  return data;
}

/** 對應「系統設定」公司 LOGO 上傳，回傳可存入 logo_url 的相對網址。 */
export async function uploadSettingsLogo(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<{ url: string }>('/system-settings/upload-logo', form);
  return data.url;
}

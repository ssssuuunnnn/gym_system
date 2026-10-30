import { apiClient } from './client';

/** 這家店的行業類型與功能開關（backend/app/routers/tenant_profile.py、ADR 0011） */
export type BusinessType = '健身' | '美體';

export interface TenantProfile {
  /** 店家名稱（系統設定的簡稱，沒有就用公司名稱）：網頁標題、登入頁用 */
  name: string;
  business_type: BusinessType;
  /** 團體課程功能（美體店預設關閉，可在系統設定打開） */
  group_classes_enabled: boolean;
}

/** 不需登入 */
export async function getTenantProfile() {
  const { data } = await apiClient.get<TenantProfile>('/tenant/profile');
  return data;
}

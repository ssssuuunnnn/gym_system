import { apiClient } from './client';

/** 這家店的行業類型與功能開關（backend/app/routers/tenant_profile.py、ADR 0011） */
export type BusinessType = '健身' | '美體';

export interface TenantProfile {
  /** 店家名稱（系統設定的簡稱，沒有就用公司名稱）：網頁標題、登入頁用 */
  name: string;
  business_type: BusinessType;
  /** 團體課程功能（美體店預設關閉，可在系統設定打開） */
  group_classes_enabled: boolean;
  /** 試用中且有到期日的店家才有（ADR 0013） */
  trial: TrialInfo | null;
}

/** 平台的聯絡方式（只有平台設定為顯示的欄位） */
export interface PlatformContact {
  brand_name: string;
  email: string | null;
  line: string | null;
  line_url: string | null;
  phone: string | null;
}

export interface TrialInfo {
  /** 伺服器 UTC */
  ends_at: string;
  days_left: number;
  expired: boolean;
  contact: PlatformContact;
}

/** 不需登入 */
/** 試用到期時，店家 API 回 403 的 detail（backend/app/deps.py TRIAL_EXPIRED_DETAIL） */
export const TRIAL_EXPIRED_DETAIL = '試用已到期';
/** client.ts 收到上面的 403 時發出的 window 事件，TrialGate 收到就重新讀取試用狀態 */
export const TRIAL_EXPIRED_EVENT = 'trial-expired';

export async function getTenantProfile() {
  const { data } = await apiClient.get<TenantProfile>('/tenant/profile');
  return data;
}

import { apiClient } from './client';

/** 對應 backend/app/routers/onboarding.py（ADR 0016） */
export type OnboardingStepKey = 'profile' | 'payment' | 'staff' | 'plans' | 'website' | 'members' | 'line';

export interface OnboardingStep {
  key: OnboardingStepKey;
  done: boolean;
  /** 選做：不影響「完成」 */
  optional: boolean;
}

/** 必做全部完成時，試用中的店家多送的試用天數（R66） */
export interface OnboardingBonus {
  days: number;
  /** available＝完成就送；granted＝已經送過 */
  status: 'available' | 'granted';
  granted_at: string | null;
  /** 伺服器 UTC */
  trial_ends_at: string | null;
  /** 這次讀取時剛送出 */
  just_granted: boolean;
}

export interface OnboardingChecklist {
  steps: OnboardingStep[];
  done_count: number;
  required_count: number;
  completed: boolean;
  dismissed: boolean;
  /** 不是試用中的店家為 null */
  bonus: OnboardingBonus | null;
}

export async function getOnboarding() {
  const { data } = await apiClient.get<OnboardingChecklist>('/onboarding');
  return data;
}

export async function dismissOnboarding() {
  const { data } = await apiClient.post<OnboardingChecklist>('/onboarding/dismiss');
  return data;
}

export async function restoreOnboarding() {
  const { data } = await apiClient.post<OnboardingChecklist>('/onboarding/restore');
  return data;
}

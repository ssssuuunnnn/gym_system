import { apiClient } from './client';

/** 對應 backend/app/routers/onboarding.py（ADR 0016） */
export type OnboardingStepKey = 'profile' | 'payment' | 'staff' | 'plans' | 'website' | 'members' | 'line';

export interface OnboardingStep {
  key: OnboardingStepKey;
  done: boolean;
  /** 選做：不影響「完成」 */
  optional: boolean;
}

/** 開店設定送試用天數（R66）：每完成一項必做 +1 天，全部完成再 +4 天 */
export interface OnboardingBonus {
  /** available＝還有天數可以拿；granted＝全部拿到了 */
  status: 'available' | 'granted';
  days_per_step: number;
  completion_days: number;
  total_days: number;
  earned_days: number;
  /** 已送過天數的步驟 */
  granted_steps: OnboardingStepKey[];
  /** 伺服器 UTC */
  trial_ends_at: string | null;
  /** 這次讀取時剛送出的天數 */
  just_granted_days: number;
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

import { apiClient } from './client';

/** 對應 backend/app/routers/onboarding.py（ADR 0016） */
export type OnboardingStepKey = 'profile' | 'payment' | 'staff' | 'plans' | 'website' | 'members' | 'line';

export interface OnboardingStep {
  key: OnboardingStepKey;
  done: boolean;
  /** 選做：不影響「完成」 */
  optional: boolean;
}

export interface OnboardingChecklist {
  steps: OnboardingStep[];
  done_count: number;
  required_count: number;
  completed: boolean;
  dismissed: boolean;
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

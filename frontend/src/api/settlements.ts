import { apiClient } from './client';

/** 後端 Decimal 欄位以字串序列化（如 "400.00"），呼叫端一律以 Number(...) 轉為數字使用。 */
export interface SettlementRates {
  id: number;
  group_course_rate: string;
  private_rate: string;
  venue_rental_rate: string;
  updated_at: string;
}

export interface SettlementRatesPayload {
  group_course_rate?: number;
  private_rate?: number;
  venue_rental_rate?: number;
}

export type SettlementSessionType = '團體課程' | '一對一' | '場租';

export interface SettlementSessionDetail {
  session_type: SettlementSessionType;
  course_name: string;
  session_date: string;
  start_minute: number;
  duration_minutes: number;
  rate: string;
  subtotal: string;
}

export type SettlementStatus = '待確認' | '已鎖定';

export interface CoachSettlementRow {
  coach_id: number;
  coach_name: string;
  group_course_count: number;
  private_count: number;
  venue_rental_count: number;
  payable_amount: string;
  status: SettlementStatus;
  sessions: SettlementSessionDetail[];
}

export interface CoachSettlementSummary {
  year: number;
  month: number;
  period_start: string;
  period_end: string;
  coach_count: number;
  total_payable: string;
  is_locked: boolean;
  locked_at: string | null;
  rows: CoachSettlementRow[];
}

export async function getSettlementRates() {
  const { data } = await apiClient.get<SettlementRates>('/coach-settlements/rates');
  return data;
}

export async function updateSettlementRates(payload: SettlementRatesPayload) {
  const { data } = await apiClient.put<SettlementRates>('/coach-settlements/rates', payload);
  return data;
}

export async function getSettlement(year: number, month: number) {
  const { data } = await apiClient.get<CoachSettlementSummary>('/coach-settlements', {
    params: { year, month },
  });
  return data;
}

export async function lockSettlement(year: number, month: number) {
  const { data } = await apiClient.post<CoachSettlementSummary>('/coach-settlements/lock', { year, month });
  return data;
}

export async function unlockSettlement(year: number, month: number) {
  const { data } = await apiClient.post<CoachSettlementSummary>('/coach-settlements/unlock', { year, month });
  return data;
}

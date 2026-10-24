import { apiClient } from './client';
import type { CoachType } from './coaches';

export type PayoutStatus = '已結算' | '已撥款';
export type PayoutItemKind = '私人課' | '團體課';

export interface PayoutItem {
  kind: PayoutItemKind;
  course_id: number | null;
  title: string;
  session_date: string;
  start_hour: number;
  /** 這堂的教練費：私人課＝教練私人課費率；團體課＝課程每堂教練費 */
  fee: number;
  attended_count: number;
  no_show_count: number;
  /** 學員帳號，以「、」分隔 */
  members: string;
}

export interface CoachPayout {
  id: number;
  coach_id: number;
  /** 結算月份（該月 1 日，YYYY-MM-DD） */
  period: string;
  session_count: number;
  /** 結算當下的私人課每堂鐘點費（參考用；團體課依各堂 fee） */
  rate: number;
  /** 應付金額＝明細 fee 加總 */
  amount: number;
  status: PayoutStatus;
  settled_at: string;
  settled_by: number;
  paid_at: string | null;
  paid_by: number | null;
  payment_note: string | null;
}

export interface CoachPayoutDetail extends CoachPayout {
  items: PayoutItem[];
}

export interface CoachPayoutSummaryRow {
  coach_id: number;
  coach_name: string;
  coach_types: CoachType[];
  /** 私人課每堂鐘點費（團體課依課程設定） */
  session_rate: number;
  live_session_count: number;
  live_amount: number;
  payout: CoachPayout | null;
  /** 結算後出席紀錄有異動：即時計算與結算快照不一致 */
  changed_since_settled: boolean;
  /** 有計費堂數但費用為 0（私人課費率或課程教練費未設定） */
  has_zero_fee: boolean;
}

/** 教練鐘點總表（管理員）；month 格式 YYYY-MM */
export async function getPayoutSummary(month: string) {
  const { data } = await apiClient.get<CoachPayoutSummaryRow[]>('/coach-payouts/summary', { params: { month } });
  return data;
}

/** 尚未結算時的即時明細（管理員） */
export async function getLivePayoutItems(coachId: number, month: string) {
  const { data } = await apiClient.get<PayoutItem[]>('/coach-payouts/live', { params: { coach_id: coachId, month } });
  return data;
}

/** 結算某教練某月（只能結算已結束的月份） */
export async function settlePayout(coachId: number, month: string) {
  const { data } = await apiClient.post<CoachPayoutDetail>('/coach-payouts', { coach_id: coachId, month });
  return data;
}

export async function getPayout(id: number) {
  const { data } = await apiClient.get<CoachPayoutDetail>(`/coach-payouts/${id}`);
  return data;
}

export async function markPayoutPaid(id: number, paymentNote: string | null) {
  const { data } = await apiClient.post<CoachPayout>(`/coach-payouts/${id}/mark-paid`, { payment_note: paymentNote });
  return data;
}

/** 取消結算（已撥款的不可取消） */
export async function voidPayout(id: number) {
  await apiClient.delete(`/coach-payouts/${id}`);
}

/** 教練查看自己的結算紀錄 */
export async function listMyPayouts() {
  const { data } = await apiClient.get<CoachPayout[]>('/coach-payouts/mine');
  return data;
}

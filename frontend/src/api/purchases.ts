import { apiClient } from './client';

export interface Purchase {
  id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  purchase_date: string;
  amount: number;
  remaining_hours: number;
  created_by: number;
  created_at: string;
}

export async function listPurchases(userId?: number) {
  const { data } = await apiClient.get<Purchase[]>('/purchases', {
    params: userId !== undefined ? { user_id: userId } : undefined,
  });
  return data;
}

export interface PurchaseCreatePayload {
  user_id: number;
  product_id: number;
  quantity: number;
  purchase_date: string;
  amount: number;
}

export async function createPurchase(payload: PurchaseCreatePayload) {
  const { data } = await apiClient.post<Purchase>('/purchases', payload);
  return data;
}

export interface SelfPurchasePayload {
  product_id: number;
  quantity: number;
}

/** 會員自助購買：歸屬對象、金額、購買日期一律由後端帶入 */
export async function createSelfPurchase(payload: SelfPurchasePayload) {
  const { data } = await apiClient.post<Purchase>('/purchases/self', payload);
  return data;
}

export type HourLedgerReason = '期初餘額' | '購買' | '預約扣抵' | '預約退回' | '手動調整';

/** 堂數異動紀錄一筆（delta 正數＝增加、負數＝扣抵） */
export interface HourLedgerEntry {
  id: number;
  purchase_id: number;
  reservation_id: number | null;
  delta: number;
  balance_after: number;
  reason: HourLedgerReason;
  note: string | null;
  created_by: number | null;
  created_at: string;
}

/** 查詢某筆購買紀錄的堂數異動（會員僅能查自己的） */
export async function listPurchaseLedger(purchaseId: number) {
  const { data } = await apiClient.get<HourLedgerEntry[]>(`/purchases/${purchaseId}/ledger`);
  return data;
}

/** 管理員手動調整堂數：change 正數補堂、負數扣堂，note 必填 */
export async function adjustPurchaseHours(purchaseId: number, payload: { change: number; note: string }) {
  const { data } = await apiClient.post<HourLedgerEntry>(`/purchases/${purchaseId}/adjust`, payload);
  return data;
}

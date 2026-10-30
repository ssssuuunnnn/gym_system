import { apiClient } from './client';

export type PaymentStatus = '待付款' | '已付款' | '已取消';
/** 體驗券＝用體驗券換到的堂數（金額 0，ADR 0010），不會出現在收款選單 */
export type PaymentMethod = '現金' | '轉帳' | '刷卡' | '其他' | '體驗券';

/** 收款時可選的付款方式 */
export const PAYMENT_METHODS: PaymentMethod[] = ['現金', '轉帳', '刷卡', '其他'];

export interface Purchase {
  id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  purchase_date: string;
  /** 應付金額（使用優惠券時為折後金額） */
  amount: number;
  /** 使用優惠券時的原價、折抵金額與券名 */
  original_amount: number | null;
  discount_amount: number;
  coupon_name: string | null;
  /** 購買總堂數（下單當下的商品堂數 × 數量） */
  total_hours: number;
  /** 剩餘堂數：待付款時為 0，確認收款後才入帳 */
  remaining_hours: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  payment_note: string | null;
  paid_at: string | null;
  paid_confirmed_by: number | null;
  cancelled_at: string | null;
  created_by: number;
  created_at: string;
}

/** 管理員可依 userId／付款狀態篩選；會員一律只會拿到自己的紀錄 */
export async function listPurchases(userId?: number, paymentStatus?: PaymentStatus) {
  const params: Record<string, string | number> = {};
  if (userId !== undefined) params.user_id = userId;
  if (paymentStatus !== undefined) params.payment_status = paymentStatus;
  const { data } = await apiClient.get<Purchase[]>('/purchases', { params });
  return data;
}

export interface PurchaseCreatePayload {
  user_id: number;
  product_id: number;
  quantity: number;
  purchase_date: string;
  amount: number;
  payment_method?: PaymentMethod | null;
  payment_note?: string | null;
  /** 使用會員手上的優惠券：金額改由後端計算 */
  member_coupon_id?: number | null;
  coupon_code?: string | null;
}

/** 管理員登錄購買：視為已收款，建立即為「已付款」並入帳堂數 */
export async function createPurchase(payload: PurchaseCreatePayload) {
  const { data } = await apiClient.post<Purchase>('/purchases', payload);
  return data;
}

export interface SelfPurchasePayload {
  product_id: number;
  quantity: number;
  /** 輸入公開代碼，或從「我的優惠券」挑一張（擇一） */
  coupon_code?: string | null;
  member_coupon_id?: number | null;
}

/** 會員自助購買：歸屬對象、金額、購買日期一律由後端帶入；建立為「待付款」 */
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

/** 管理員確認收款：待付款 → 已付款，並入帳堂數 */
export async function confirmPayment(
  purchaseId: number,
  payload: { payment_method: PaymentMethod; payment_note?: string | null },
) {
  const { data } = await apiClient.post<Purchase>(`/purchases/${purchaseId}/confirm-payment`, payload);
  return data;
}

/** 取消待付款訂單（管理員任一筆、會員僅自己的）；用品會歸還庫存 */
export async function cancelPurchase(purchaseId: number) {
  const { data } = await apiClient.post<Purchase>(`/purchases/${purchaseId}/cancel`);
  return data;
}

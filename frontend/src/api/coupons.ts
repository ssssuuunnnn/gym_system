import { apiClient } from './client';
import type { Purchase } from './purchases';

/** 體驗券與折價券（backend/app/routers/coupons.py、ADR 0010） */
export type CouponKind = '體驗券' | '折價券';
export type DiscountType = '折抵金額' | '折扣';
export type CouponSource = '輸入代碼' | '櫃台發放' | 'LINE 加入' | '轉為會員';
export type MemberCouponStatus = '可使用' | '已使用' | '已過期' | '已作廢';

export interface CouponInput {
  name: string;
  kind: CouponKind;
  description: string | null;
  /** 公開代碼（英數，存成大寫）；沒有代碼就只能由後台發放 */
  code: string | null;
  discount_type: DiscountType | null;
  /** 折抵金額（元），或折扣百分比（15＝85 折） */
  discount_value: number | null;
  min_amount: number;
  /** 適用方案；空＝全部 */
  product_ids: number[];
  /** 體驗券送的方案 */
  trial_product_id: number | null;
  /** 用體驗券上的課是否計教練鐘點 */
  counts_for_payout: boolean;
  /** LINE 新加入會員時自動發放 */
  issue_on_line_join: boolean;
  valid_from: string | null;
  valid_until: string | null;
  /** 發出後幾天內有效 */
  valid_days: number | null;
  total_limit: number | null;
  per_member_limit: number;
  new_member_only: boolean;
  is_active: boolean;
}

export interface Coupon extends CouponInput {
  id: number;
  created_by_name: string | null;
  created_at: string;
  /** 一行說明：折 300 元／8.5 折／送「單堂體驗課」1 堂 */
  summary: string;
  issued_count: number;
  used_count: number;
}

export interface CouponOption {
  id: number;
  name: string;
  kind: CouponKind;
  summary: string;
}

export interface MemberCoupon {
  id: number;
  coupon_id: number;
  user_id: number;
  member_name: string;
  name: string;
  kind: CouponKind;
  description: string | null;
  summary: string;
  status: MemberCouponStatus;
  source: CouponSource;
  issued_by_name: string | null;
  issued_at: string;
  /** 最後可使用的日期（YYYY-MM-DD） */
  expires_on: string | null;
  used_at: string | null;
  purchase_id: number | null;
  void_reason: string | null;
  product_ids: number[];
  trial_product_id: number | null;
  min_amount: number;
}

export interface CouponIssueResult {
  issued: number;
  skipped: { user_id: number; name: string; reason: string }[];
}

export interface CouponQuote {
  original: number;
  discount: number;
  final: number;
  coupon_name: string | null;
  member_coupon_id: number | null;
}

export interface UsableCoupon {
  member_coupon: MemberCoupon;
  usable: boolean;
  discount: number;
  final: number;
  /** 不能用的原因 */
  reason: string | null;
}

// ---------- 後台 ----------

export async function listCoupons() {
  const { data } = await apiClient.get<Coupon[]>('/coupons');
  return data;
}

export async function listCouponOptions(kind?: CouponKind) {
  const { data } = await apiClient.get<CouponOption[]>('/coupons/options', { params: kind ? { kind } : {} });
  return data;
}

export async function createCoupon(payload: CouponInput) {
  const { data } = await apiClient.post<Coupon>('/coupons', payload);
  return data;
}

export async function updateCoupon(id: number, payload: CouponInput) {
  const { data } = await apiClient.put<Coupon>(`/coupons/${id}`, payload);
  return data;
}

export async function issueCoupon(id: number, userIds: number[]) {
  const { data } = await apiClient.post<CouponIssueResult>(`/coupons/${id}/issue`, { user_ids: userIds });
  return data;
}

export async function listCouponUsage(id: number) {
  const { data } = await apiClient.get<MemberCoupon[]>(`/coupons/${id}/member-coupons`);
  return data;
}

export async function voidMemberCoupon(id: number, reason: string | null) {
  const { data } = await apiClient.post<MemberCoupon>(`/coupons/member-coupons/${id}/void`, { reason });
  return data;
}

// ---------- 會員 ----------

export async function listMyCoupons() {
  const { data } = await apiClient.get<MemberCoupon[]>('/coupons/mine');
  return data;
}

export async function claimCoupon(code: string) {
  const { data } = await apiClient.post<MemberCoupon>('/coupons/claim', { code });
  return data;
}

/** 使用體驗券：換成一筆金額 0、已付款的購買紀錄 */
export async function redeemTrialCoupon(memberCouponId: number) {
  const { data } = await apiClient.post<Purchase>(`/coupons/mine/${memberCouponId}/redeem`);
  return data;
}

// ---------- 結帳試算（會員自己；後台帶 userId 替會員） ----------

export async function listUsableCoupons(productId: number, quantity: number, userId?: number) {
  const { data } = await apiClient.get<UsableCoupon[]>('/coupons/usable', {
    params: { product_id: productId, quantity, user_id: userId },
  });
  return data;
}

export async function quoteCoupon(payload: {
  product_id: number;
  quantity: number;
  code?: string | null;
  member_coupon_id?: number | null;
  user_id?: number;
}) {
  const { data } = await apiClient.post<CouponQuote>('/coupons/quote', payload);
  return data;
}

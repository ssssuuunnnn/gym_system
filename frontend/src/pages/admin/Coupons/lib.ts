import dayjs from 'dayjs';
import type { Coupon, CouponInput } from '../../../api/coupons';

/** 表單上「折扣」用台灣習慣的「幾折」輸入（8.5 折），存成折扣百分比（15） */
export const rateToPercentOff = (rate: number) => Math.round(100 - rate * 10);
export const percentOffToRate = (percent: number) => (100 - percent) / 10;

/** 有效期間的一行說明 */
export function validityText(c: Pick<Coupon, 'valid_from' | 'valid_until' | 'valid_days'>): string {
  const parts: string[] = [];
  if (c.valid_from || c.valid_until) {
    const from = c.valid_from ? dayjs(c.valid_from).format('YYYY/M/D') : '即日起';
    const until = c.valid_until ? dayjs(c.valid_until).format('YYYY/M/D') : '不限';
    parts.push(`${from} ～ ${until}`);
  }
  if (c.valid_days) parts.push(`發出後 ${c.valid_days} 天內`);
  return parts.length ? parts.join('，') : '不限期';
}

/** 停用／啟用時用目前的設定組出完整的更新內容 */
export function toInput(c: Coupon): CouponInput {
  return {
    name: c.name,
    kind: c.kind,
    description: c.description,
    code: c.code,
    discount_type: c.discount_type,
    discount_value: c.discount_value,
    min_amount: c.min_amount,
    product_ids: c.product_ids,
    trial_product_id: c.trial_product_id,
    counts_for_payout: c.counts_for_payout,
    issue_on_line_join: c.issue_on_line_join,
    valid_from: c.valid_from,
    valid_until: c.valid_until,
    valid_days: c.valid_days,
    total_limit: c.total_limit,
    per_member_limit: c.per_member_limit,
    new_member_only: c.new_member_only,
    is_active: c.is_active,
  };
}

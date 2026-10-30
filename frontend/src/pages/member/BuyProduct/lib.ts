import type { Product, ProductCategory } from '../../../api/products';
import type { BookIntent } from '../../../lib/bookIntent';
import type { Terms } from '../../../lib/terms';

/** 會員端的分類名稱：「課程」類方案就是私人課（美體：個人療程）用的方案（ADR 0011 行業用詞） */
export function memberCategoryLabel(category: ProductCategory, t: Terms): string {
  if (category === '團體課程') return t.group;
  if (category === '課程') return t.private;
  return '商品';
}

export function formatPrice(value: number): string {
  return `NT$ ${value.toLocaleString()}`;
}

/** 這個方案能不能用來預約想預約的那堂課（規則同預約頁 R15） */
export function fitsIntent(product: Product, intent: BookIntent | null): boolean {
  if (!intent) return false;
  if (intent.kind === 'group') return product.course_id === intent.courseId;
  // 私人課：「課程」類方案，而且能在那間分店使用（沒限定分店＝全分店通用）
  return (
    product.category === '課程' &&
    (intent.branchId == null || product.branch_ids.length === 0 || product.branch_ids.includes(intent.branchId))
  );
}

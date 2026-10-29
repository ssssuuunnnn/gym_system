import { apiClient } from './client';

/** 團體課程＝綁定已排程課程；課程＝單次課程（堂數自填）；用品＝有庫存的實體商品 */
export type ProductCategory = '團體課程' | '課程' | '用品';

export interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  /** 分類為「團體課程」時綁定的課程 id；其餘為 null */
  course_id: number | null;
  /** 堂數：團體課程＝所綁課程課堂數、課程＝自填、用品＝0 */
  session_hours: number;
  /** 分類為「用品」的庫存量；其餘為 null */
  stock: number | null;
  price: number;
  is_active: boolean;
  /** 限定使用的分店（只有「課程」可設）；空＝全分店通用 */
  branch_ids: number[];
  created_at: string;
}

export const PRODUCT_CATEGORIES: ProductCategory[] = ['團體課程', '課程', '用品'];

export async function listProducts() {
  const { data } = await apiClient.get<Product[]>('/products');
  return data;
}

export interface ProductPayload {
  name: string;
  category: ProductCategory;
  price: number;
  is_active: boolean;
  /** 分類為「團體課程」時必填 */
  course_id?: number | null;
  /** 分類為「課程」時必填（單次課程堂數） */
  session_hours?: number | null;
  /** 分類為「用品」時必填 */
  stock?: number | null;
  /** 限定使用的分店；空＝全分店通用 */
  branch_ids?: number[];
}

export async function createProduct(payload: ProductPayload) {
  const { data } = await apiClient.post<Product>('/products', payload);
  return data;
}

export async function updateProduct(id: number, payload: Partial<ProductPayload>) {
  const { data } = await apiClient.put<Product>(`/products/${id}`, payload);
  return data;
}

import { apiClient } from './client';

export type ProductCategory = '團體課程' | '用品';

export interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  /** 分類為「課程」時綁定的團體課程 id；「用品」為 null */
  course_id: number | null;
  /** 分類為「課程」＝所綁課程的課堂數；「用品」＝0 */
  session_hours: number;
  /** 分類為「用品」的庫存量；「課程」為 null */
  stock: number | null;
  price: number;
  is_active: boolean;
  created_at: string;
}

export const PRODUCT_CATEGORIES: ProductCategory[] = ['團體課程', '用品'];

export async function listProducts() {
  const { data } = await apiClient.get<Product[]>('/products');
  return data;
}

export interface ProductPayload {
  name: string;
  category: ProductCategory;
  price: number;
  is_active: boolean;
  /** 分類為「課程」時必填 */
  course_id?: number | null;
  /** 分類為「用品」時必填 */
  stock?: number | null;
}

export async function createProduct(payload: ProductPayload) {
  const { data } = await apiClient.post<Product>('/products', payload);
  return data;
}

export async function updateProduct(id: number, payload: Partial<ProductPayload>) {
  const { data } = await apiClient.put<Product>(`/products/${id}`, payload);
  return data;
}

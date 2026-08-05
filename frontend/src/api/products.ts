import { apiClient } from './client';

export type ProductCategory =
  | '私人教練1對1'
  | '私人教練1對2'
  | '場租1對1'
  | '包場'
  | '團體課'
  | '自主訓練'
  | '臨時加人'
  | '手綁帶';

export interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  session_hours: number;
  price: number;
  is_active: boolean;
  created_at: string;
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  '私人教練1對1',
  '私人教練1對2',
  '場租1對1',
  '包場',
  '團體課',
  '自主訓練',
  '臨時加人',
  '手綁帶',
];

export async function listProducts() {
  const { data } = await apiClient.get<Product[]>('/products');
  return data;
}

export interface ProductPayload {
  name: string;
  category: ProductCategory;
  session_hours: number;
  price: number;
  is_active: boolean;
}

export async function createProduct(payload: ProductPayload) {
  const { data } = await apiClient.post<Product>('/products', payload);
  return data;
}

export async function updateProduct(id: number, payload: Partial<ProductPayload>) {
  const { data } = await apiClient.put<Product>(`/products/${id}`, payload);
  return data;
}

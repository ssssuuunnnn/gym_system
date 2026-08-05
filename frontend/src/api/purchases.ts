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

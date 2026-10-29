import { apiClient } from './client';

/** 分店（後端 routers/branches.py、ADR 0007）：同一家公司底下的營業地點 */
export interface Branch {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface BranchPayload {
  name: string;
  address?: string | null;
  phone?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

/** 依排序列出分店（會員只會拿到啟用中的） */
export async function listBranches() {
  const { data } = await apiClient.get<Branch[]>('/branches');
  return data;
}

export async function createBranch(payload: BranchPayload) {
  const { data } = await apiClient.post<Branch>('/branches', payload);
  return data;
}

export async function updateBranch(id: number, payload: Partial<BranchPayload>) {
  const { data } = await apiClient.put<Branch>(`/branches/${id}`, payload);
  return data;
}

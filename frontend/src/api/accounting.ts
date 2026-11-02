import { apiClient } from './client';
import type { PaymentMethod } from './purchases';

/**
 * 收支報表（ADR 0014、R57–R60）與第二期（ADR 0015、R61–R64）。
 * 現金制：收入＝已付款購買，支出＝已撥款鐘點；權責制：上完課才算收入，人員費用依已結算鐘點的上課日。
 */

/** 計算方式 */
export type Basis = 'cash' | 'accrual';
export const BASIS_LABEL: Record<Basis, string> = { cash: '現金制', accrual: '權責制' };

export type EntryKind = '收入' | '支出';
export const ENTRY_KINDS: EntryKind[] = ['收入', '支出'];

/** 手動帳目可選的付款方式（不含「體驗券」） */
export const ENTRY_PAYMENT_METHODS: PaymentMethod[] = ['現金', '轉帳', '刷卡', '其他'];

export interface AccountingCategory {
  id: number;
  kind: EntryKind;
  name: string;
  is_active: boolean;
  sort_order: number;
  /** 已經有帳目：不能刪除，只能停用 */
  in_use: boolean;
}

export interface AccountingEntry {
  id: number;
  kind: EntryKind;
  category_id: number;
  category_name: string;
  entry_date: string;
  amount: number;
  payment_method: PaymentMethod;
  /** null＝全店共同 */
  branch_id: number | null;
  note: string | null;
  created_by_name: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by_name: string | null;
  /** 有附收據（R64） */
  has_receipt: boolean;
}

export interface EntryPayload {
  kind: EntryKind;
  category_id: number;
  entry_date: string;
  amount: number;
  payment_method: PaymentMethod;
  branch_id: number | null;
  note: string | null;
}

/** 報表的一行：sales＝方案銷售（依商品類別）、payout＝鐘點撥款、manual＝手動帳目分類 */
export type TxnSource = 'sales' | 'payout' | 'manual';

export interface ReportLine {
  key: string;
  label: string;
  source: TxnSource;
  amount: number;
  count: number;
}

export interface AccountingReport {
  start: string;
  end: string;
  branch_id: number | null;
  income: number;
  expense: number;
  net: number;
  income_lines: ReportLine[];
  expense_lines: ReportLine[];
  payment_methods: { method: string; amount: number; count: number }[];
  /** 方案銷售的優惠折抵總額 */
  discount_total: number;
  /** 0 元的銷售（體驗券兌換）筆數 */
  zero_amount_count: number;
  /** 看單一分店時：全店共同的手動帳目 */
  shared: { income: number; expense: number } | null;
  basis: Basis;
  /** 權責制：期間內還沒有已結算鐘點的月份（YYYY-MM） */
  months_without_payouts: string[];
  /** 期間內已關帳的月份（YYYY-MM） */
  closed_months: string[];
}

export interface TrendPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface Transaction {
  date: string;
  kind: EntryKind;
  source: TxnSource;
  category_key: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string | null;
  branch_id: number | null;
  ref_id: number;
}

export interface Period {
  start: string;
  end: string;
  branch_id?: number | null;
  basis?: Basis;
}

/** branch_id 為 null（全部分店）時不送 */
function params<T extends Period>({ branch_id, ...rest }: T) {
  return branch_id != null ? { ...rest, branch_id } : rest;
}

export async function getReport(period: Period) {
  const { data } = await apiClient.get<AccountingReport>('/accounting/report', { params: params(period) });
  return data;
}

export async function getTrend(months: number, branchId: number | null, basis: Basis = 'cash') {
  const { data } = await apiClient.get<TrendPoint[]>('/accounting/trend', {
    params: branchId != null ? { months, basis, branch_id: branchId } : { months, basis },
  });
  return data;
}

export async function listTransactions(period: Period) {
  const { data } = await apiClient.get<Transaction[]>('/accounting/transactions', { params: params(period) });
  return data;
}

export async function listCategories() {
  const { data } = await apiClient.get<AccountingCategory[]>('/accounting/categories');
  return data;
}

export async function createCategory(payload: { kind: EntryKind; name: string }) {
  const { data } = await apiClient.post<AccountingCategory>('/accounting/categories', payload);
  return data;
}

export async function updateCategory(id: number, payload: { name?: string; is_active?: boolean; sort_order?: number }) {
  const { data } = await apiClient.put<AccountingCategory>(`/accounting/categories/${id}`, payload);
  return data;
}

export async function deleteCategory(id: number) {
  await apiClient.delete(`/accounting/categories/${id}`);
}

export async function listEntries(period: Period & { include_deleted?: boolean }) {
  const { data } = await apiClient.get<AccountingEntry[]>('/accounting/entries', { params: params(period) });
  return data;
}

export async function createEntry(payload: EntryPayload) {
  const { data } = await apiClient.post<AccountingEntry>('/accounting/entries', payload);
  return data;
}

export async function updateEntry(id: number, payload: EntryPayload) {
  const { data } = await apiClient.put<AccountingEntry>(`/accounting/entries/${id}`, payload);
  return data;
}

export async function deleteEntry(id: number) {
  const { data } = await apiClient.delete<AccountingEntry>(`/accounting/entries/${id}`);
  return data;
}

// ---------- 收據（R64）：不公開，用帶權杖的請求取回檔案 ----------

export async function uploadReceipt(entryId: number, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<AccountingEntry>(`/accounting/entries/${entryId}/receipt`, form);
  return data;
}

export async function fetchReceipt(entryId: number) {
  const { data } = await apiClient.get<Blob>(`/accounting/entries/${entryId}/receipt`, { responseType: 'blob' });
  return data;
}

export async function deleteReceipt(entryId: number) {
  const { data } = await apiClient.delete<AccountingEntry>(`/accounting/entries/${entryId}/receipt`);
  return data;
}

// ---------- 預收款（R62） ----------

export interface DeferredLine {
  product_id: number;
  label: string;
  category: string;
  count: number;
  /** 還沒上的堂數 */
  hours: number;
  amount: number;
}

export interface Deferred {
  as_of: string;
  branch_id: number | null;
  total: number;
  hours: number;
  lines: DeferredLine[];
}

export async function getDeferred(asOf: string, branchId: number | null) {
  const { data } = await apiClient.get<Deferred>('/accounting/deferred', {
    params: branchId != null ? { as_of: asOf, branch_id: branchId } : { as_of: asOf },
  });
  return data;
}

// ---------- 關帳（R63） ----------

export interface CloseTotals {
  income: number;
  expense: number;
  net: number;
}

export interface AccountingClose {
  /** 該月 1 日 */
  period: string;
  is_closed: boolean;
  closed_at: string;
  closed_by_name: string | null;
  reopened_at: string | null;
  reopened_by_name: string | null;
  snapshot: { cash?: CloseTotals; accrual?: CloseTotals; deferred?: number };
}

export async function listCloses() {
  const { data } = await apiClient.get<AccountingClose[]>('/accounting/closes');
  return data;
}

export async function closeMonth(month: string) {
  const { data } = await apiClient.post<AccountingClose>('/accounting/closes', { month });
  return data;
}

export async function reopenMonth(month: string) {
  const { data } = await apiClient.post<AccountingClose>(`/accounting/closes/${month}/reopen`);
  return data;
}

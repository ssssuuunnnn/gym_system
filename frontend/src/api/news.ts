import { apiClient } from './client';
import type { SegmentFilters } from './memberSegments';

/** 最新消息（後端 routers/news.py、ADR 0012） */
export interface NewsPost {
  id: number;
  title: string;
  summary: string;
  body: string;
  image_url: string | null;
  is_published: boolean;
  /** 第一次發布時間（伺服器 UTC，顯示用 formatServerTime） */
  published_at: string | null;
  created_by_name: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
  /** 網站上的網址（相對路徑，例如 /site/news/3） */
  path: string;
  broadcast_count: number;
  last_broadcast_at: string | null;
}

export interface NewsInput {
  title: string;
  summary: string;
  body: string;
  image_url: string | null;
  is_published: boolean;
}

/** LINE 發送對象：會員標籤（有任一個）與／或會員名單條件，兩者聯集 */
export interface BroadcastTarget {
  tag_ids: number[];
  filters: SegmentFilters | null;
}

export interface BroadcastPreview {
  total: number;
  sendable: number;
  no_line: number;
  no_consent: number;
  already_sent: number;
  to_send: number;
  oa_enabled: boolean;
  website_published: boolean;
  /** 不能發送的原因（空＝可以發） */
  problems: string[];
}

export interface NewsBroadcast {
  id: number;
  target_label: string;
  matched_count: number;
  queued_count: number;
  created_by_name: string | null;
  created_at: string;
}

export interface NewsBroadcastList {
  delivery: { sent: number; failed: number; pending: number; skipped: number };
  items: NewsBroadcast[];
}

export async function listNews() {
  const { data } = await apiClient.get<NewsPost[]>('/news');
  return data;
}

export async function createNews(payload: NewsInput) {
  const { data } = await apiClient.post<NewsPost>('/news', payload);
  return data;
}

export async function updateNews(id: number, payload: NewsInput) {
  const { data } = await apiClient.put<NewsPost>(`/news/${id}`, payload);
  return data;
}

export async function deleteNews(id: number) {
  await apiClient.delete(`/news/${id}`);
}

export async function previewBroadcast(id: number, target: BroadcastTarget) {
  const { data } = await apiClient.post<BroadcastPreview>(`/news/${id}/broadcast/preview`, target);
  return data;
}

export async function sendBroadcast(id: number, target: BroadcastTarget) {
  const { data } = await apiClient.post<{ broadcast_id: number; queued: number }>(`/news/${id}/broadcast`, target);
  return data;
}

export async function listBroadcasts(id: number) {
  const { data } = await apiClient.get<NewsBroadcastList>(`/news/${id}/broadcasts`);
  return data;
}

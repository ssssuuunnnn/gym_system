import { apiClient } from './client';

/** 對應 backend/app/schemas/website.py 的 SiteContent（見 docs/adr/0003-gym-website.md） */
export type SectionKey = 'hero' | 'about' | 'schedule' | 'coaches' | 'pricing' | 'gallery' | 'faq' | 'trial' | 'contact';

/** 一定會顯示、不能關閉的段落（與後端 REQUIRED_SECTIONS 一致） */
export const REQUIRED_SECTIONS: SectionKey[] = ['hero', 'about', 'contact'];

export const SECTION_LABEL: Record<SectionKey, string> = {
  hero: '主視覺',
  about: '關於我們',
  schedule: '團體課表',
  coaches: '教練團隊',
  pricing: '方案價格',
  gallery: '環境照片',
  faq: '常見問題',
  trial: '預約體驗課',
  contact: '交通與聯絡',
};

/** 品牌色（與後端 BRAND_COLORS 一致；每個都確認過文字對比） */
export const BRAND_COLORS = [
  { hex: '#C3400D', name: '橘紅' },
  { hex: '#0B7A75', name: '青綠' },
  { hex: '#2F54EB', name: '藍' },
  { hex: '#722ED1', name: '紫' },
  { hex: '#1F1F1F', name: '黑' },
] as const;
export type BrandColor = (typeof BRAND_COLORS)[number]['hex'];

export interface SiteContent {
  theme: 'bold';
  brand_color: BrandColor;
  seo: { title: string; description: string; og_image_url: string | null };
  sections: { key: SectionKey; visible: boolean }[];
  hero: { eyebrow: string; tagline: string; description: string; image_url: string | null };
  about: { title: string; text: string; features: { title: string; text: string }[] };
  schedule: { title: string; show_seats: boolean };
  coaches: { title: string; items: { coach_id: number; bio: string }[] };
  pricing: { title: string; items: { product_id: number; description: string }[]; note: string };
  gallery: { title: string; images: { url: string; caption: string }[] };
  faq: { title: string; items: { q: string; a: string }[] };
  trial: { title: string; intro: string; interests: string[]; slots: string[]; privacy_notice: string };
  contact: {
    title: string;
    address: string;
    transport: string;
    phone: string;
    hours: string;
    line: string;
    instagram: string;
    facebook: string;
  };
}

export interface WebsiteState {
  draft: SiteContent;
  is_published: boolean;
  has_unpublished_changes: boolean;
  published_at: string | null;
  published_by_name: string | null;
  updated_at: string;
  updated_by_name: string | null;
}

export async function getWebsite() {
  const { data } = await apiClient.get<WebsiteState>('/website');
  return data;
}

export async function saveWebsiteDraft(content: SiteContent) {
  const { data } = await apiClient.put<WebsiteState>('/website/draft', content);
  return data;
}

export async function publishWebsite() {
  const { data } = await apiClient.post<WebsiteState>('/website/publish');
  return data;
}

export async function unpublishWebsite() {
  const { data } = await apiClient.post<WebsiteState>('/website/unpublish');
  return data;
}

export async function discardWebsiteDraft() {
  const { data } = await apiClient.post<WebsiteState>('/website/discard-draft');
  return data;
}

export async function getWebsitePreviewToken() {
  const { data } = await apiClient.post<{ token: string; expires_in: number }>('/website/preview-token');
  return data;
}

export async function uploadWebsiteImage(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<{ url: string }>('/website/upload-image', form);
  return data;
}

/** 與後端 routers/site.py 的 _line_url 相同規則：@ID 轉成加好友連結 */
export function lineAddFriendUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith('https://')) return v;
  return `https://line.me/R/ti/p/${v.startsWith('@') ? v : `@${v}`}`;
}

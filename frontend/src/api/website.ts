import { apiClient } from './client';

/** 對應 backend/app/schemas/website.py 的 SiteContent（見 docs/adr/0003-gym-website.md） */
export type SectionKey = 'hero' | 'about' | 'news' | 'schedule' | 'coaches' | 'pricing' | 'gallery' | 'faq' | 'trial' | 'contact';

/** 一定會顯示、不能關閉的段落（與後端 REQUIRED_SECTIONS 一致） */
export const REQUIRED_SECTIONS: SectionKey[] = ['hero', 'about', 'contact'];

export const SECTION_LABEL: Record<SectionKey, string> = {
  hero: '主視覺',
  about: '關於我們',
  news: '最新消息',
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

/**
 * 版型（與後端 SITE_THEMES 一致）。同一份內容，只換外觀；swatch 是版型縮圖用的代表色與排版
 * （網站本身的顏色，不是後台介面的顏色）：stack＝由上而下段落、grid＝方格、editorial＝雜誌、sidebar＝側欄。
 */
export const SITE_THEMES = [
  {
    key: 'bold',
    name: '活力',
    description: '深色主視覺、粗體大字，運動感強烈',
    suits: '重訓、拳擊、CrossFit',
    swatch: { layout: 'stack', page: '#ffffff', hero: '#15181d', heroText: '#ffffff', block: '#f4f5f7', radius: 6, serif: false },
  },
  {
    key: 'airy',
    name: '清爽',
    description: '白底、大量留白、圓角照片與柔和陰影',
    suits: '瑜珈、皮拉提斯、女性工作室',
    swatch: { layout: 'stack', page: '#ffffff', hero: '#f4f8fb', heroText: '#1e2a33', block: '#ffffff', radius: 12, serif: false },
  },
  {
    key: 'warm',
    name: '溫暖',
    description: '米白大地色、襯線標題、拱形照片',
    suits: '社區型、復健、慢活教室',
    swatch: { layout: 'stack', page: '#faf5ee', hero: '#faf5ee', heroText: '#3b2f27', block: '#f7f0e7', radius: 40, serif: true },
  },
  {
    key: 'bento',
    name: '方格',
    description: '首頁就是一整片大小不一的方塊：照片、下一堂課、方案、教練一眼看完',
    suits: '課程多、想讓客人馬上看到課表與價格',
    swatch: { layout: 'grid', page: '#eef0f3', hero: '#15181d', heroText: '#ffffff', block: '#ffffff', radius: 8, serif: false },
  },
  {
    key: 'editorial',
    name: '雜誌',
    description: '像雜誌內頁：大襯線標題、編號章節、細線留白，方案排成價目表',
    suits: '有故事的品牌、精品工作室、想做出質感',
    swatch: { layout: 'editorial', page: '#fbf9f4', hero: '#fbf9f4', heroText: '#16140f', block: '#d9d4c7', radius: 0, serif: true },
  },
  {
    key: 'sidebar',
    name: '側欄',
    description: '像 App：左邊固定目錄、右邊一張張卡片，首頁就看到下一堂課與方案起價',
    suits: '課程與方案多、想讓客人快速找到資訊',
    swatch: { layout: 'sidebar', page: '#f3f4f6', hero: '#ffffff', heroText: '#14171c', block: '#ffffff', radius: 8, serif: false },
  },
] as const;
export type SiteTheme = (typeof SITE_THEMES)[number]['key'];

export interface SiteContent {
  theme: SiteTheme;
  brand_color: BrandColor;
  seo: { title: string; description: string; og_image_url: string | null };
  sections: { key: SectionKey; visible: boolean }[];
  hero: { eyebrow: string; tagline: string; description: string; image_url: string | null };
  about: { title: string; text: string; features: { title: string; text: string }[] };
  schedule: { title: string; show_seats: boolean };
  coaches: { title: string; items: { coach_id: number; bio: string }[] };
  pricing: { title: string; items: { product_id: number; description: string }[]; note: string };
  gallery: { title: string; images: { url: string; caption: string }[] };
  news: { title: string; count: number };
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
    youtube: string;
    threads: string;
    tiktok: string;
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

/**
 * 品牌色的對比檢查（與後端 backend/app/core/colors.py 同一套規則與數值；後端才是最後把關）。
 * 品牌色同時是按鈕的底色（上面放白字）與淺色底上的文字色，所以要對 #EEF0F3（各版型最深的淺色區塊）
 * 與自己的 8% 淺色底都 ≥ 4.5:1。
 */
export const MIN_BRAND_CONTRAST = 4.5;
const CONTRAST_REFERENCE = '#EEF0F3';
const SOFT_MIX = 0.08;

type Rgb = [number, number, number];

/** '#abc'、'abc'、'#aabbcc' → '#AABBCC'；格式不對回傳 null */
export function normalizeHex(value: string): string | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(value.trim());
  if (!m) return null;
  const digits = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return `#${digits.toUpperCase()}`;
}

const toRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;
const toHex = (rgb: Rgb) =>
  `#${rgb.map((c) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const mix = (a: string, b: string, weightA: number) => {
  const ra = toRgb(a);
  const rb = toRgb(b);
  return toHex(ra.map((x, i) => x * weightA + rb[i] * (1 - weightA)) as Rgb);
};

function luminance(hex: string) {
  const [r, g, b] = toRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** 品牌色在網站上最差情況的對比 */
export function brandContrast(hex: string) {
  return Math.min(contrast(hex, CONTRAST_REFERENCE), contrast(hex, mix(hex, '#FFFFFF', SOFT_MIX)));
}

export interface BrandColorCheck {
  /** 正規化後的色碼；格式不對時為 null */
  hex: string | null;
  ratio: number | null;
  ok: boolean;
  /** 太淺時建議的顏色：同色相往黑色調深到剛好合格 */
  suggestion: string | null;
}

export function checkBrandColor(value: string): BrandColorCheck {
  const hex = normalizeHex(value);
  if (!hex) return { hex: null, ratio: null, ok: false, suggestion: null };
  const ratio = brandContrast(hex);
  if (ratio >= MIN_BRAND_CONTRAST) return { hex, ratio, ok: true, suggestion: null };
  let suggestion: string | null = null;
  for (let step = 1; step <= 100; step += 1) {
    const candidate = mix('#000000', hex, step / 100);
    if (brandContrast(candidate) >= MIN_BRAND_CONTRAST) {
      suggestion = candidate;
      break;
    }
  }
  return { hex, ratio, ok: false, suggestion };
}

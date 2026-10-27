/** 形象網站編輯器的小工具（只給本頁使用）。 */

/** 把陣列第 index 個往前（-1）或往後（+1）移一格；超出範圍時原樣回傳 */
export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = items.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function removeItem<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

export function replaceItem<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}

/** 段落編輯面板的共用 props：value 是 SiteContent 裡的一段，onChange 回傳整段 */
export interface PanelProps<T> {
  value: T;
  onChange: (value: T) => void;
}

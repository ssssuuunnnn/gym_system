/**
 * 星期標籤的單一來源。
 *
 * 慣例：`day_of_week` 採 ISO-8601 週日編號 —— **1 = 週一 … 7 = 週日**。
 * `courses.day_of_week` 與 `time_slots.day_of_week`（1–6，無週日）皆用此軸。
 *
 * 用途：
 * - 表頭 `.map()` → `WEEKDAY_SHORT_MON_FIRST`
 * - 由數字轉標籤 → `weekdayShort(dow)` / `weekdayLabel(dow)`
 */

/** 週一起算的短標籤：index 0 = 週一 … index 6 = 週日。給固定週一～週日順序的表頭 `.map()` 用。 */
export const WEEKDAY_SHORT_MON_FIRST = ['一', '二', '三', '四', '五', '六', '日'] as const;

/** `day_of_week`(1–7) → `"一"` … `"日"`；超出範圍回傳空字串。 */
export function weekdayShort(dayOfWeek: number): string {
  return WEEKDAY_SHORT_MON_FIRST[dayOfWeek - 1] ?? '';
}

/** `day_of_week`(1–7) → `"週一"` … `"週日"`；超出範圍回傳原數字字串。 */
export function weekdayLabel(dayOfWeek: number): string {
  const s = weekdayShort(dayOfWeek);
  return s ? `週${s}` : String(dayOfWeek);
}

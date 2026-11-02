/**
 * 會員在這台裝置上次選的分店（預約課程頁的分店切換）。
 * 預約頁用來記住選擇；購買方案時一併送出，作為收入歸屬的分店（ADR 0014、R58）。
 */
const KEY = 'bookBranchId';

export function loadMemberBranch(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function saveMemberBranch(id: number) {
  try {
    localStorage.setItem(KEY, String(id));
  } catch {
    // 無痕模式等無法寫入時只是不記住
  }
}

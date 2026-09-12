/** NT$ 金額格式化（含千分位）。對應「教練費用結算」等頁面的金額顯示。 */
export function formatCurrency(value: number): string {
  return `NT$ ${Number(value).toLocaleString()}`;
}

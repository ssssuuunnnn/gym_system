export type CsvValue = string | number | null | undefined;

function csvCell(value: CsvValue): string {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 下載 CSV（加 BOM，Excel 開啟中文不會亂碼）；第一列是標題 */
export function downloadCsv(filename: string, rows: CsvValue[][]) {
  const text = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

import dayjs, { type Dayjs } from 'dayjs';
import type { Transaction } from '../../../api/accounting';
import { downloadCsv } from '../../../lib/csv';

export const money = (n: number) => `NT$ ${Math.round(n).toLocaleString('zh-TW')}`;

/** 帶正負號（淨額用） */
export const signedMoney = (n: number) => (n < 0 ? `−${money(-n)}` : money(n));

export type Range = [Dayjs, Dayjs];

/** 收支報表相關的查詢（記帳後全部重新整理） */
export const ACCOUNTING_KEYS = [
  ['accounting-report'],
  ['accounting-trend'],
  ['accounting-transactions'],
  ['accounting-entries'],
  ['accounting-categories'],
  ['accounting-deferred'],
  ['accounting-closes'],
];

/** 已關帳的月份（YYYY-MM）集合 → 某天是否落在已關帳的月份（R63） */
export function isClosedDay(closed: Set<string>, day: string | Dayjs) {
  return closed.has(dayjs(day).format('YYYY-MM'));
}

/** 期間快速選項（RangePicker presets） */
export function periodPresets(): { label: string; value: Range }[] {
  const now = dayjs();
  return [
    { label: '本月', value: [now.startOf('month'), now.endOf('month')] },
    { label: '上個月', value: [now.subtract(1, 'month').startOf('month'), now.subtract(1, 'month').endOf('month')] },
    { label: '近 3 個月', value: [now.subtract(2, 'month').startOf('month'), now.endOf('month')] },
    { label: '今年', value: [now.startOf('year'), now.endOf('year')] },
  ];
}

export const thisMonth = (): Range => [dayjs().startOf('month'), dayjs().endOf('month')];

export const SOURCE_LABEL: Record<Transaction['source'], string> = {
  sales: '方案銷售',
  payout: '人員費用',
  manual: '手動記帳',
};

/** 下載期間明細 CSV（給會計） */
export function exportTransactions(
  rows: Transaction[],
  range: Range,
  branchName: (id: number | null) => string,
  basisLabel: string,
) {
  const name = `收支明細_${basisLabel}_${range[0].format('YYYYMMDD')}-${range[1].format('YYYYMMDD')}.csv`;
  downloadCsv(name, [
    ['日期', '收支', '來源', '分類', '說明', '金額', '付款方式', '分店'],
    ...rows.map((r) => [
      r.date,
      r.kind,
      SOURCE_LABEL[r.source],
      r.category,
      r.description,
      r.kind === '支出' ? -r.amount : r.amount,
      r.payment_method,
      r.branch_id == null ? '全店共同' : branchName(r.branch_id),
    ]),
  ]);
}

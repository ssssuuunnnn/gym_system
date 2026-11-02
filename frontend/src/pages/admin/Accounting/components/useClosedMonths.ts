import { useQuery } from '@tanstack/react-query';
import { listCloses } from '../../../../api/accounting';

/** 已關帳的月份（YYYY-MM）：記帳、收據與日期選擇用來鎖住該月（R63） */
export function useClosedMonths() {
  const query = useQuery({ queryKey: ['accounting-closes'], queryFn: listCloses });
  return new Set((query.data ?? []).filter((c) => c.is_closed).map((c) => c.period.slice(0, 7)));
}

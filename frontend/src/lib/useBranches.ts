import { useQuery } from '@tanstack/react-query';
import { listBranches, type Branch } from '../api/branches';

/**
 * 分店清單與查詢（ADR 0007）：後台、會員前台共用同一個 ['branches'] 快取。
 * 會員從 API 只拿到啟用中的分店；管理員拿到全部，`active` 另外過濾掉停用的。
 */
export function useBranches() {
  const query = useQuery({ queryKey: ['branches'], queryFn: listBranches });
  const branches = query.data ?? [];
  const active = branches.filter((b) => b.is_active);
  const byId = new Map(branches.map((b) => [b.id, b]));
  return {
    ...query,
    branches,
    active,
    /** 排序最前面的啟用分店（新增資料時的預設值） */
    defaultId: active[0]?.id ?? branches[0]?.id ?? null,
    nameOf: (id: number | null | undefined) => (id != null ? (byId.get(id)?.name ?? `分店 #${id}`) : '—'),
    byId,
  };
}

export type { Branch };

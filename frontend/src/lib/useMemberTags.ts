import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listMemberTags, type MemberTag } from '../api/memberTags';

/** 會員標籤清單與 id → 標籤 的對照（會員列表、會員詳情、會員名單、最新消息共用，快取 ['member-tags']） */
export function useMemberTags(enabled = true) {
  const { data, isLoading } = useQuery({ queryKey: ['member-tags'], queryFn: listMemberTags, enabled });
  const tags = useMemo(() => data ?? [], [data]);
  const byId = useMemo(() => new Map<number, MemberTag>(tags.map((t) => [t.id, t])), [tags]);
  return { tags, byId, isLoading };
}

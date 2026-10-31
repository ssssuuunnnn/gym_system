import { Space, Tag } from 'antd';
import { useMemberTags } from '../lib/useMemberTags';

/** 依 id 顯示會員身上的標籤（已刪除的標籤略過）；沒有標籤時顯示 —。 */
export function MemberTagList({ ids, empty = '—' }: { ids?: number[]; empty?: string }) {
  const { byId } = useMemberTags();
  const tags = (ids ?? []).map((id) => byId.get(id)).filter((t) => t !== undefined);
  if (!tags.length) return <>{empty}</>;
  return (
    <Space size={[0, 4]} wrap>
      {tags.map((t) => (
        <Tag key={t.id} color={t.color}>
          {t.name}
        </Tag>
      ))}
    </Space>
  );
}

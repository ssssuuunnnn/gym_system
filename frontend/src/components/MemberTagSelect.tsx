import { Select, Tag } from 'antd';
import type { CSSProperties } from 'react';
import { useMemberTags } from '../lib/useMemberTags';

export interface MemberTagSelectProps {
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  /** 在選項旁顯示人數（篩選、發送時用） */
  showCount?: boolean;
  disabled?: boolean;
  id?: string;
  style?: CSSProperties;
}

/** 會員標籤多選（ADR 0012）：選項與已選的都用標籤本身的顏色顯示。 */
export function MemberTagSelect({ value, onChange, placeholder = '選擇標籤', showCount, disabled, id, style }: MemberTagSelectProps) {
  const { tags, byId, isLoading } = useMemberTags();
  return (
    <Select
      id={id}
      mode="multiple"
      allowClear
      loading={isLoading}
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      optionFilterProp="label"
      style={{ minWidth: 200, ...style }}
      options={tags.map((t) => ({ value: t.id, label: t.name }))}
      optionRender={(option) => {
        const tag = byId.get(option.value as number);
        return (
          <span>
            <Tag color={tag?.color} style={{ marginInlineEnd: 6 }}>
              {option.label}
            </Tag>
            {showCount && tag ? <span style={{ fontSize: 12, opacity: 0.65 }}>{tag.member_count} 人</span> : null}
          </span>
        );
      }}
      tagRender={({ value: v, closable, onClose }) => {
        const tag = byId.get(v as number);
        return (
          <Tag color={tag?.color} closable={closable} onClose={onClose} style={{ marginInlineEnd: 4 }}>
            {tag?.name ?? '已刪除'}
          </Tag>
        );
      }}
      notFoundContent="還沒有標籤，請先到「會員標籤」新增"
    />
  );
}

import { Segmented, Select } from 'antd';
import type { CSSProperties } from 'react';
import type { Branch } from '../api/branches';

/** 分店數超過這個數量就改用下拉選單 */
const SEGMENTED_MAX = 4;

export interface BranchPickerProps {
  branches: Branch[];
  /** 選中的分店；null＝全部分店（需 allowAll） */
  value: number | null;
  onChange: (value: number | null) => void;
  /** 多一個「全部分店」選項（列表篩選用） */
  allowAll?: boolean;
  disabled?: boolean;
  /** 給 label htmlFor 用 */
  id?: string;
  style?: CSSProperties;
}

/**
 * 分店切換（ADR 0007）：分店少時用 Segmented 一眼看完，多時改用 Select。
 * 公休設定、課程與預約列表的篩選、會員預約頁共用。
 */
export function BranchPicker({ branches, value, onChange, allowAll, disabled, id, style }: BranchPickerProps) {
  const ALL = 0;
  const options = [
    ...(allowAll ? [{ value: ALL, label: '全部分店' }] : []),
    ...branches.map((b) => ({ value: b.id, label: b.is_active ? b.name : `${b.name}（停用）` })),
  ];
  const current = value ?? ALL;
  const emit = (v: number) => onChange(v === ALL ? null : v);
  if (options.length <= SEGMENTED_MAX) {
    return (
      <Segmented<number>
        id={id}
        value={current}
        options={options}
        onChange={emit}
        disabled={disabled}
        style={{ maxWidth: '100%', overflowX: 'auto', ...style }}
      />
    );
  }
  return (
    <Select<number>
      id={id}
      value={current}
      options={options}
      onChange={emit}
      disabled={disabled}
      style={{ minWidth: 180, ...style }}
    />
  );
}

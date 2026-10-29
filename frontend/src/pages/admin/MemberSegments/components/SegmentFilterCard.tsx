import { Button, Card, DatePicker, Flex, InputNumber, Segmented, Select, Tooltip, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { SegmentFilters, SegmentKind } from '../../../../api/memberSegments';
import { PRESETS } from '../lib';

export interface SegmentFilterCardProps {
  value: SegmentFilters;
  onChange: (value: SegmentFilters) => void;
  /** 套用目前條件查詢 */
  onSearch: (value: SegmentFilters) => void;
  coachOptions: { value: number; label: string }[];
  branchOptions: { value: number; label: string }[];
  loading?: boolean;
}

const KINDS: SegmentKind[] = ['全部', '團體課', '私人課'];

/** 會員名單的篩選條件：常用名單一鍵帶入，或自己調整條件後查詢 */
export function SegmentFilterCard({ value, onChange, onSearch, coachOptions, branchOptions, loading }: SegmentFilterCardProps) {
  const set = (patch: Partial<SegmentFilters>) => onChange({ ...value, ...patch });
  const field = (label: string, htmlFor: string, control: React.ReactNode, width: number | 'auto' = 200) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width }}>
      <label htmlFor={htmlFor} style={{ fontSize: 13 }}>
        {label}
      </label>
      {control}
    </div>
  );

  return (
    <Card title="篩選條件">
      <Flex vertical gap={20}>
        <Flex gap={8} wrap align="center">
          <Typography.Text type="secondary">常用名單：</Typography.Text>
          {PRESETS.map((p) => (
            <Tooltip key={p.key} title={p.hint}>
              <Button
                onClick={() => {
                  const f = p.filters();
                  onChange(f);
                  onSearch(f);
                }}
              >
                {p.label}
              </Button>
            </Tooltip>
          ))}
        </Flex>

        <Flex gap={16} wrap align="flex-end">
          {field(
            '上課期間（有「已出席」紀錄）',
            'seg-range',
            <DatePicker.RangePicker
              id="seg-range"
              allowClear={false}
              value={[dayjs(value.start), dayjs(value.end)]}
              onChange={(range) => {
                if (range?.[0] && range[1]) set({ start: range[0].format('YYYY-MM-DD'), end: range[1].format('YYYY-MM-DD') });
              }}
              presets={[
                { label: '最近 1 個月', value: [dayjs().subtract(1, 'month'), dayjs()] },
                { label: '最近 3 個月', value: [dayjs().subtract(3, 'month'), dayjs()] },
                { label: '最近 6 個月', value: [dayjs().subtract(6, 'month'), dayjs()] },
                { label: '最近 1 年', value: [dayjs().subtract(1, 'year').add(1, 'day'), dayjs()] },
              ]}
            />,
            280,
          )}
          {field(
            '課程類型',
            'seg-kind',
            <Segmented<SegmentKind> id="seg-kind" value={value.kind} options={KINDS} onChange={(kind) => set({ kind })} />,
            'auto',
          )}
          {field(
            '分店',
            'seg-branch',
            <Select
              id="seg-branch"
              allowClear
              placeholder="全部分店"
              value={value.branch_id ?? undefined}
              options={branchOptions}
              onChange={(v) => set({ branch_id: v ?? null })}
            />,
            160,
          )}
          {field(
            '教練',
            'seg-coach',
            <Select
              id="seg-coach"
              allowClear
              placeholder="全部教練"
              value={value.coach_id ?? undefined}
              options={coachOptions}
              onChange={(v) => set({ coach_id: v ?? null })}
            />,
          )}
        </Flex>

        <Flex gap={16} wrap align="flex-end">
          {field(
            '期間內出席次數至少',
            'seg-min',
            <InputNumber
              id="seg-min"
              min={1}
              max={999}
              precision={0}
              value={value.min_attended}
              onChange={(v) => set({ min_attended: v ?? 1 })}
              suffix="次"
              style={{ width: '100%' }}
            />,
            160,
          )}
          {field(
            '剩餘堂數不超過',
            'seg-hours',
            <InputNumber
              id="seg-hours"
              min={0}
              precision={0}
              placeholder="不限"
              value={value.max_remaining_hours}
              onChange={(v) => set({ max_remaining_hours: v ?? null })}
              suffix="堂"
              style={{ width: '100%' }}
            />,
            160,
          )}
          {field(
            '最後一次上課距今超過',
            'seg-inactive',
            <InputNumber
              id="seg-inactive"
              min={1}
              max={3650}
              precision={0}
              placeholder="不限"
              value={value.inactive_days}
              onChange={(v) => set({ inactive_days: v ?? null })}
              suffix="天"
              style={{ width: '100%' }}
            />,
            180,
          )}
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => onSearch(value)}>
            查詢
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
}

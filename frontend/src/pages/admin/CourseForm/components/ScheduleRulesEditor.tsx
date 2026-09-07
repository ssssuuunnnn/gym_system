import { DatePicker, InputNumber, Select, theme } from 'antd';
import dayjs from 'dayjs';
import { InlineRuleList, InlineRuleRow } from '../../../../components/InlineRuleList';
import type { RuleState } from '../lib/recurrence';
import { TIME_OPTIONS, disabledPastDate } from '../lib/recurrence';
import type { ScheduleEndMode, ScheduleFrequency } from '../../../../api/courses';

const FREQ_OPTIONS: { value: ScheduleFrequency; label: string }[] = [
  { value: '每週', label: '每週' },
  { value: '隔週', label: '隔週' },
];

const END_MODE_OPTIONS: { value: ScheduleEndMode; label: string }[] = [
  { value: '連續', label: '連續' },
  { value: '結束於', label: '結束於' },
];

export interface ScheduleRulesEditorProps {
  rules: RuleState[];
  onPatchRule: (id: string, patch: Partial<RuleState>) => void;
  onRemoveRule: (id: string) => void;
  onAddRule: () => void;
  summaryFor: (rule: RuleState) => string;
}

export function ScheduleRulesEditor(props: ScheduleRulesEditorProps) {
  const { rules, onPatchRule, onRemoveRule, onAddRule, summaryFor } = props;
  const { token } = theme.useToken();

  return (
    <InlineRuleList
      title="排課規則"
      description="一列產生一組週期性課堂；同一堂課有兩個時段就加第二列"
      chipPrefix="規則"
      addLabel="新增一列規則"
      onAdd={onAddRule}
    >
      {rules.map((r, idx) => (
        <InlineRuleRow key={r.id} index={idx} onRemove={() => onRemoveRule(r.id)}>
          <span style={{ fontSize: 14, color: token.colorTextSecondary }}>開始</span>
          <DatePicker
            size="small"
            allowClear={false}
            disabledDate={disabledPastDate}
            value={dayjs(r.startKey)}
            onChange={(d) => d && onPatchRule(r.id, { startKey: d.format('YYYY-MM-DD') })}
            style={{ width: 140 }}
          />
          <span style={{ fontSize: 14, color: token.colorTextSecondary }}>時間</span>
          <Select
            size="small"
            value={r.minute}
            onChange={(v) => onPatchRule(r.id, { minute: v })}
            options={TIME_OPTIONS}
            style={{ width: 96 }}
          />
          <Select
            size="small"
            value={r.freq}
            onChange={(v) => onPatchRule(r.id, { freq: v })}
            options={FREQ_OPTIONS}
            style={{ width: 84 }}
          />
          <Select
            size="small"
            value={r.endMode}
            onChange={(v) => onPatchRule(r.id, { endMode: v })}
            options={END_MODE_OPTIONS}
            style={{ width: 96 }}
          />
          {r.endMode === '連續' ? (
            <InputNumber
              size="small"
              min={1}
              max={104}
              value={r.count}
              onChange={(v) => onPatchRule(r.id, { count: v ?? 1 })}
              addonAfter="週"
              style={{ width: 96 }}
            />
          ) : (
            <DatePicker
              size="small"
              allowClear={false}
              disabledDate={disabledPastDate}
              value={dayjs(r.endKey)}
              onChange={(d) => d && onPatchRule(r.id, { endKey: d.format('YYYY-MM-DD') })}
              style={{ width: 140 }}
            />
          )}
          <span style={{ fontSize: 12, color: token.colorTextTertiary }}>{summaryFor(r)}</span>
        </InlineRuleRow>
      ))}
    </InlineRuleList>
  );
}

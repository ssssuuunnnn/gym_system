import { Checkbox, DatePicker, InputNumber, Radio, Select, Typography, theme } from 'antd';
import dayjs from 'dayjs';
import { FieldRow } from './FieldRow';
import { WEEKDAY_SHORT_MON_FIRST } from '../../../../lib/weekday';
import { TIME_OPTIONS, disabledPastDate, type ScheduleSpec } from '../lib/recurrence';
import type { ScheduleEndMode } from '../../../../api/courses';

const WEEKDAY_OPTIONS = WEEKDAY_SHORT_MON_FIRST.map((s, i) => ({ label: `週${s}`, value: i + 1 }));
const END_MODE_OPTIONS: { label: string; value: ScheduleEndMode }[] = [
  { label: '指定週數', value: '週數' },
  { label: '指定結束日', value: '結束日' },
];

export interface ScheduleSpecFormProps {
  value: ScheduleSpec;
  onChange: (patch: Partial<ScheduleSpec>) => void;
  /** 摘要文字（含實際堂數） */
  summary: string;
  readOnly?: boolean;
}

export function ScheduleSpecForm(props: ScheduleSpecFormProps) {
  const { value, onChange, summary, readOnly = false } = props;
  const { token } = theme.useToken();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <FieldRow label="上課星期" required>
        <Checkbox.Group
          disabled={readOnly}
          options={WEEKDAY_OPTIONS}
          value={value.weekdays}
          onChange={(v) =>
            onChange({
              weekdays: (v as (string | number)[])
                .map(Number)
                .filter((n) => n >= 1 && n <= 7)
                .sort((a, b) => a - b),
            })
          }
        />
      </FieldRow>

      <FieldRow label="上課時間" required>
        <Select
          disabled={readOnly}
          value={value.startMinute}
          onChange={(v) => onChange({ startMinute: v })}
          options={TIME_OPTIONS}
          style={{ width: 120 }}
        />
      </FieldRow>

      <FieldRow label="開課期間" required alignTop>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: token.colorTextSecondary }}>從</span>
            <DatePicker
              disabled={readOnly}
              allowClear={false}
              disabledDate={disabledPastDate}
              value={value.startDate ? dayjs(value.startDate) : null}
              onChange={(d) => d && onChange({ startDate: d.format('YYYY-MM-DD') })}
              style={{ width: 150 }}
            />
            <Radio.Group
              disabled={readOnly}
              optionType="button"
              size="small"
              options={END_MODE_OPTIONS}
              value={value.endMode}
              onChange={(e) => onChange({ endMode: e.target.value as ScheduleEndMode })}
            />
            {value.endMode === '週數' ? (
              <InputNumber
                disabled={readOnly}
                min={1}
                max={104}
                value={value.weekCount}
                onChange={(v) => onChange({ weekCount: v ?? 1 })}
                addonAfter="週"
                style={{ width: 110 }}
              />
            ) : (
              <DatePicker
                disabled={readOnly}
                allowClear={false}
                disabledDate={disabledPastDate}
                value={value.endDate ? dayjs(value.endDate) : null}
                onChange={(d) => d && onChange({ endDate: d.format('YYYY-MM-DD') })}
                style={{ width: 150 }}
              />
            )}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {summary}
          </Typography.Text>
        </div>
      </FieldRow>
    </div>
  );
}

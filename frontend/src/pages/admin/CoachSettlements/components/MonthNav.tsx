import { Button, DatePicker } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';

interface MonthNavProps {
  value: Dayjs;
  onChange: (next: Dayjs) => void;
}

/** 教練費用結算頁的月份切換：上一月／下一月按鈕 + 月份選擇器（受控元件）。 */
export default function MonthNav({ value, onChange }: MonthNavProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Button
        icon={<LeftOutlined />}
        onClick={() => onChange(value.subtract(1, 'month'))}
        aria-label="上一月"
      />
      <DatePicker
        picker="month"
        value={value}
        onChange={(next) => next && onChange(next)}
        allowClear={false}
        format="YYYY 年 MM 月"
        style={{ width: 140 }}
      />
      <Button
        icon={<RightOutlined />}
        onClick={() => onChange(value.add(1, 'month'))}
        aria-label="下一月"
      />
    </div>
  );
}

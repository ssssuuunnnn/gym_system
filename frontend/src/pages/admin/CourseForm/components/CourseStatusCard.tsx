import { Card, Radio, theme } from 'antd';
import type { CourseStatus } from '../../../../api/courses';
import { COURSE_STATUSES } from '../../../../api/courses';

const STATUS_HINT: Record<CourseStatus, string> = {
  上架: '儲存後立即開放會員於 App 報名',
  下架: '僅後台可見，不開放報名',
  草稿: '僅保留設定內容，不列入排程與報名，可於列表繼續編輯',
};

export interface CourseStatusCardProps {
  value: CourseStatus;
  onChange: (status: CourseStatus) => void;
}

export function CourseStatusCard({ value, onChange }: CourseStatusCardProps) {
  const { token } = theme.useToken();
  return (
    <Card title="課程狀態">
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <Radio.Group value={value} onChange={(e) => onChange(e.target.value as CourseStatus)}>
          {COURSE_STATUSES.map((s) => (
            <Radio key={s} value={s}>
              {s}
            </Radio>
          ))}
        </Radio.Group>
        <span style={{ fontSize: 13, color: token.colorTextTertiary }}>{STATUS_HINT[value]}</span>
      </div>
    </Card>
  );
}

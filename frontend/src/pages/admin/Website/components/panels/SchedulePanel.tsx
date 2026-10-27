import { Alert, Form, Input, Switch } from 'antd';
import { Link } from 'react-router-dom';
import type { SiteContent } from '../../../../../api/website';
import type { PanelProps } from '../../lib';

type Schedule = SiteContent['schedule'];

/** 團體課表：內容自動來自課程管理，這裡只設定標題與是否顯示剩餘名額。 */
export function SchedulePanel({ value, onChange }: PanelProps<Schedule>) {
  return (
    <Form layout="vertical">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={
          <>
            自動顯示「上架」團體課程未來 7 天的課堂，停課會自動移除；本週沒有課時整段隱藏。課程在
            <Link to="/admin/courses">課程管理</Link>維護。
          </>
        }
      />
      <Form.Item htmlFor="site-schedule-1" label="段落標題">
        <Input id="site-schedule-1" value={value.title} maxLength={30} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      </Form.Item>
      <Form.Item htmlFor="site-schedule-2" label="顯示剩餘名額" extra="開啟時每堂課顯示「剩 N 位／已額滿」；關閉則只顯示課名、時間與教練。">
        <Switch id="site-schedule-2" checked={value.show_seats} onChange={(show_seats) => onChange({ ...value, show_seats })} />
      </Form.Item>
    </Form>
  );
}

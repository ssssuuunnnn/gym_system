import { Button, Space, Typography, theme } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import SlotPicker, { type SlotEvent } from '../../../../components/SlotPicker';
import { startOfWeekMon } from '../../../../components/calendar/shared';
import { isoWeekday } from '../../../../lib/availability';
import { weekdayShort } from '../../../../lib/weekday';
import { formatMinute, type Occurrence } from '../lib/recurrence';

export interface SchedulePreviewCalendarProps {
  anchor: Dayjs;
  onAnchorChange: (next: Dayjs) => void;
  occurrences: Occurrence[];
  courseName: string;
  durationMinutes: number;
  onAddExtra: (dateKey: string, minute: number) => void;
  onRemoveOcc: (occId: string) => void;
}

function label(d: Dayjs): string {
  return `${d.format('YYYY/M/D')}(${weekdayShort(isoWeekday(d))})`;
}

export function SchedulePreviewCalendar(props: SchedulePreviewCalendarProps) {
  const { anchor, onAnchorChange, occurrences, courseName, durationMinutes, onAddExtra, onRemoveOcc } =
    props;
  const { token } = theme.useToken();

  const monday = startOfWeekMon(anchor);
  const weekDates = Array.from({ length: 7 }, (_, i) => monday.add(i, 'day'));
  const rangeTitle = `${label(weekDates[0])} – ${label(weekDates[6])}`;

  const byDayHour = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    const key = `${o.dateKey}-${Math.floor(o.minute / 60)}`;
    const list = byDayHour.get(key) ?? [];
    list.push(o);
    byDayHour.set(key, list);
  }

  const eventsFor = (date: Dayjs, hour: number): SlotEvent[] =>
    (byDayHour.get(`${date.format('YYYY-MM-DD')}-${hour}`) ?? []).map((o) => ({
      key: o.occId,
      title: courseName || '團體課程',
      subText: `${formatMinute(o.minute)}–${formatMinute(o.minute + durationMinutes)}`,
      tone: o.isExtra ? 'gold' : o.adjusted ? 'purple' : 'blue',
      onClick: () => onRemoveOcc(o.occId),
    }));

  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Button icon={<LeftOutlined />} onClick={() => onAnchorChange(monday.subtract(1, 'week'))}>
          上一週
        </Button>
        <Button icon={<RightOutlined />} onClick={() => onAnchorChange(monday.add(1, 'week'))}>
          下一週
        </Button>
        <Button onClick={() => onAnchorChange(dayjs())}>回到今天</Button>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {rangeTitle}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12, color: token.colorTextTertiary }}>
          點空白格加開單次課，點課堂可移除
        </Typography.Text>
      </Space>

      <SlotPicker
        dates={weekDates}
        cellState={() => 'open'}
        onCellClick={(d, h) => onAddExtra(d.format('YYYY-MM-DD'), h * 60)}
        cellEvents={eventsFor}
        showNowIndicator={false}
      />
    </div>
  );
}

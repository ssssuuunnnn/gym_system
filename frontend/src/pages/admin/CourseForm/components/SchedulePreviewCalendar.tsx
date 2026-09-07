import { Button, Space, Typography, theme } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import SlotPicker, { type SlotEvent } from '../../../../components/SlotPicker';
import { startOfWeekMon } from '../../../../components/calendar/shared';
import { isoWeekday } from '../../../../lib/availability';
import { weekdayShort } from '../../../../lib/weekday';
import { formatMinute, type IsSlotClosed, type PreviewSession } from '../lib/recurrence';

export interface SchedulePreviewCalendarProps {
  anchor: Dayjs;
  onAnchorChange: (next: Dayjs) => void;
  sessions: PreviewSession[];
  courseName: string;
  durationMinutes: number;
  /** 公休時段 → 灰底格 */
  isSlotClosed: IsSlotClosed;
}

function label(d: Dayjs): string {
  return `${d.format('YYYY/M/D')}(${weekdayShort(isoWeekday(d))})`;
}

/** 課程時段週曆：唯讀預覽。顯示公休灰底 + 本課課堂（停課的淡化）。編輯都在下方清單／排程表單做。 */
export function SchedulePreviewCalendar(props: SchedulePreviewCalendarProps) {
  const { anchor, onAnchorChange, sessions, courseName, durationMinutes, isSlotClosed } = props;
  const { token } = theme.useToken();

  const monday = startOfWeekMon(anchor);
  const weekDates = Array.from({ length: 7 }, (_, i) => monday.add(i, 'day'));
  const rangeTitle = `${label(weekDates[0])} – ${label(weekDates[6])}`;

  const byDayHour = new Map<string, PreviewSession[]>();
  for (const s of sessions) {
    const key = `${s.dateKey}-${Math.floor(s.minute / 60)}`;
    const list = byDayHour.get(key) ?? [];
    list.push(s);
    byDayHour.set(key, list);
  }

  const eventsFor = (date: Dayjs, hour: number): SlotEvent[] =>
    (byDayHour.get(`${date.format('YYYY-MM-DD')}-${hour}`) ?? [])
      .filter((s) => !s.closedSlot) // 公休課堂不畫方塊（格子已是灰底）
      .map((s) => ({
        key: s.key,
        title: `${s.isCancelled ? '（停課）' : ''}${courseName || '團體課程'}`,
        subText: `${formatMinute(s.minute)}–${formatMinute(s.minute + durationMinutes)}`,
        tone: s.isCancelled ? 'gray' : s.source === '加開' ? 'gold' : 'blue',
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
          唯讀預覽，灰底為公休時段
        </Typography.Text>
      </Space>

      <SlotPicker
        dates={weekDates}
        cellState={() => 'open'}
        cellDisabled={(d, h) => isSlotClosed(d.format('YYYY-MM-DD'), h * 60)}
        cellEvents={eventsFor}
        showNowIndicator={false}
      />
    </div>
  );
}

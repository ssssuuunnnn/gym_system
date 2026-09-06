import { useMemo, useState } from 'react';
import { Button, Typography, theme } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { TimeAxis } from '../../../../components/calendar/TimeAxis';
import { DayHeaderCell } from '../../../../components/calendar/DayHeaderCell';
import { EventBlock } from '../../../../components/calendar/EventBlock';
import { NowIndicator } from '../../../../components/calendar/NowIndicator';
import { DEFAULT_HOUR_HEIGHT, dateKey, startOfWeekMon } from '../../../../components/calendar/shared';
import { WEEKDAY_SHORT_MON_FIRST } from '../../../../lib/weekday';
import type { Reservation } from '../../../../api/reservations';

const START_HOUR = 10;
const END_HOUR = 22; // 不含，對應營業時段 10:00–21:00（與 SlotPicker 同一區間）

interface WeekCalendarProps {
  reservations: Reservation[];
  courseNameById: Map<number, string>;
  productNameById: Map<number, string>;
  courseDurationById: Map<number, number>;
}

/**
 * 我的預約：本週課表週檢視。只顯示待確認／已確認的預約（已拒絕／已取消不佔用時段）。
 * 組合自 `components/calendar` 的排程日曆原子組件。
 */
export default function WeekCalendar({
  reservations,
  courseNameById,
  productNameById,
  courseDurationById,
}: WeekCalendarProps) {
  const { token } = theme.useToken();
  const [weekOffset, setWeekOffset] = useState(0);
  const today = dayjs();
  const weekStart = startOfWeekMon(today).add(weekOffset, 'week');

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = weekStart.add(i, 'day');
        return {
          date,
          key: dateKey(date),
          dow: `星期${WEEKDAY_SHORT_MON_FIRST[i]}`,
          label: date.format('M/D'),
          isToday: dateKey(date) === dateKey(today),
          isWeekend: i >= 5,
        };
      }),
    [weekStart, today],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      if (r.status !== '待確認' && r.status !== '已確認') continue;
      const list = map.get(r.booking_date) ?? [];
      list.push(r);
      map.set(r.booking_date, list);
    }
    return map;
  }, [reservations]);

  const hourHeight = DEFAULT_HOUR_HEIGHT;
  const gridHeight = (END_HOUR - START_HOUR) * hourHeight;
  const nowMinutes = today.hour() * 60 + today.minute();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button size="small" icon={<LeftOutlined />} onClick={() => setWeekOffset((v) => v - 1)} />
        <Typography.Text strong>
          {weekStart.format('YYYY年M月D日')} – {weekStart.add(6, 'day').format('M月D日')}
        </Typography.Text>
        <Button size="small" icon={<RightOutlined />} onClick={() => setWeekOffset((v) => v + 1)} />
        <Button size="small" onClick={() => setWeekOffset(0)}>
          本週
        </Button>
      </div>

      <div
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <div style={{ width: 68, flex: 'none' }} />
          {days.map((d) => (
            <DayHeaderCell key={d.key} dow={d.dow} label={d.label} isToday={d.isToday} isWeekend={d.isWeekend} />
          ))}
        </div>
        <div style={{ display: 'flex', maxHeight: 420, overflowY: 'auto' }}>
          <TimeAxis startHour={START_HOUR} endHour={END_HOUR} hourHeight={hourHeight} />
          {days.map((d, i) => {
            const dayEvents = eventsByDay.get(d.key) ?? [];
            return (
              <div
                key={d.key}
                style={{
                  flex: 1,
                  minWidth: 0,
                  position: 'relative',
                  height: gridHeight,
                  borderLeft: i === 0 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                {Array.from({ length: END_HOUR - START_HOUR }, (_, row) => (
                  <div
                    key={row}
                    style={{
                      position: 'absolute',
                      top: row * hourHeight,
                      left: 0,
                      right: 0,
                      height: 0,
                      borderTop: row === 0 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                    }}
                  />
                ))}
                {dayEvents.map((r) => {
                  const durationMinutes = (r.course_id && courseDurationById.get(r.course_id)) || 60;
                  const top = (r.start_hour - START_HOUR) * hourHeight;
                  const height = (durationMinutes / 60) * hourHeight;
                  const title = (r.course_id && courseNameById.get(r.course_id)) || productNameById.get(r.product_id) || '—';
                  const startLabel = `${String(r.start_hour).padStart(2, '0')}:00`;
                  const endLabel = dayjs().hour(r.start_hour).minute(0).add(durationMinutes, 'minute').format('HH:mm');
                  return (
                    <EventBlock
                      key={r.id}
                      title={title}
                      timeText={`${startLabel} – ${endLabel}`}
                      tone={r.status === '待確認' ? 'gold' : 'blue'}
                      top={top}
                      height={height}
                    />
                  );
                })}
                {d.isToday && nowMinutes >= START_HOUR * 60 && nowMinutes < END_HOUR * 60 ? (
                  <NowIndicator minutes={nowMinutes} hourHeight={hourHeight} startHour={START_HOUR} />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

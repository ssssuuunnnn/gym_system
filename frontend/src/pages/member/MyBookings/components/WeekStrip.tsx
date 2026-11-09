import { Button, theme } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { WEEKDAY_SHORT_MON_FIRST } from '../../../../lib/weekday';

export interface WeekStripProps {
  /** 這週的週一 */
  weekStart: Dayjs;
  /** 換週（傳入新的週一） */
  onWeekChange: (weekStart: Dayjs) => void;
  /** 每天有幾筆有效預約（key：YYYY-MM-DD），有的話日期下面顯示小圓點 */
  countByDate: Map<string, number>;
  /** 點某一天（捲到那天的預約） */
  onPickDay: (date: Dayjs) => void;
}

/** 我的預約上方的週列：月份＋前後週、週一到週日，今天圈起來，有預約的日子下方有小圓點。 */
export function WeekStrip({ weekStart, onWeekChange, countByDate, onPickDay }: WeekStripProps) {
  const { token } = theme.useToken();
  const today = dayjs();
  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
  const isThisWeek = days.some((d) => d.isSame(today, 'day'));
  const end = days[6];
  const range =
    weekStart.month() === end.month()
      ? `${weekStart.format('M月D日')} – ${end.format('D日')}`
      : `${weekStart.format('M月D日')} – ${end.format('M月D日')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Button type="text" shape="circle" icon={<LeftOutlined />} aria-label="上一週" onClick={() => onWeekChange(weekStart.subtract(1, 'week'))} />
        <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{weekStart.format('YYYY 年 M 月')}</span>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{range}</span>
        </div>
        <Button type="text" shape="circle" icon={<RightOutlined />} aria-label="下一週" onClick={() => onWeekChange(weekStart.add(1, 'week'))} />
      </div>

      <div role="group" aria-label="這週的日期" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
        {days.map((d, i) => {
          const key = d.format('YYYY-MM-DD');
          const count = countByDate.get(key) ?? 0;
          const isToday = d.isSame(today, 'day');
          const weekend = i >= 5;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickDay(d)}
              aria-label={`${d.format('M 月 D 日')}${isToday ? '，今天' : ''}${count ? `，${count} 筆預約` : '，沒有預約'}`}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '2px 0 4px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                minHeight: 64,
              }}
            >
              <span style={{ fontSize: 12, color: weekend ? token.colorTextTertiary : token.colorTextSecondary }}>
                {WEEKDAY_SHORT_MON_FIRST[i]}
              </span>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: isToday ? 700 : 500,
                  background: isToday ? token.colorPrimary : 'transparent',
                  color: isToday ? token.colorTextLightSolid : weekend ? token.colorTextTertiary : token.colorText,
                }}
              >
                {d.date()}
              </span>
              <span
                aria-hidden="true"
                style={{ width: 5, height: 5, borderRadius: 3, background: count ? token.colorPrimary : 'transparent' }}
              />
            </button>
          );
        })}
      </div>

      {!isThisWeek && (
        <Button size="small" type="link" style={{ alignSelf: 'center', height: 'auto', padding: 0 }} onClick={() => onWeekChange(today)}>
          回到本週
        </Button>
      )}
    </div>
  );
}

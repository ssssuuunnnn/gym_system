import { theme } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { isoWeekday } from '../../../../lib/availability';
import { weekdayShort } from '../../../../lib/weekday';

export interface DateStripProps {
  /** 可選日期（依序顯示） */
  dates: Dayjs[];
  value: Dayjs;
  onChange: (date: Dayjs) => void;
  /** 該日有幾堂可預約（顯示小圓點；0 或未提供則不顯示） */
  countByDate?: Map<string, number>;
}

/** 預約頁上方的日期橫條：一格一天，今天標「今天」，選中的以主題色填滿。 */
export function DateStrip({ dates, value, onChange, countByDate }: DateStripProps) {
  const { token } = theme.useToken();
  const today = dayjs();
  return (
    <div role="group" aria-label="選擇日期" style={{ display: 'grid', gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))`, gap: 6 }}>
      {dates.map((d) => {
        const selected = d.isSame(value, 'day');
        const count = countByDate?.get(d.format('YYYY-MM-DD')) ?? 0;
        return (
          <button
            key={d.format('YYYY-MM-DD')}
            type="button"
            aria-pressed={selected}
            aria-label={`${d.format('M 月 D 日')}${count ? `，${count} 堂` : ''}`}
            onClick={() => onChange(d)}
            style={{
              height: 64,
              border: 'none',
              borderRadius: 14,
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: selected ? token.colorPrimary : token.colorBgContainer,
              color: selected ? token.colorTextLightSolid : token.colorText,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <span style={{ fontSize: 11, color: selected ? token.colorTextLightSolid : token.colorTextSecondary }}>
              {d.isSame(today, 'day') ? '今天' : weekdayShort(isoWeekday(d))}
            </span>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{d.date()}</span>
            <span
              aria-hidden="true"
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                background: count ? (selected ? token.colorTextLightSolid : token.colorPrimary) : 'transparent',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ReactNode } from 'react';
import { theme } from 'antd';
import { TimeAxis } from './calendar/TimeAxis';
import { DayHeaderCell } from './calendar/DayHeaderCell';
import { TimeSlotCell } from './calendar/TimeSlotCell';
import { NowIndicator } from './calendar/NowIndicator';
import { EventBlock } from './calendar/EventBlock';
import type { EventTone } from './calendar/EventChip';

/**
 * 週時間格：由 `components/calendar/` 的原子組件（TimeAxis／DayHeaderCell／TimeSlotCell／
 * NowIndicator／EventBlock）組成的多日格狀時間表。X 軸為傳入的日期欄、Y 軸為一小時刻度。
 * 每格狀態：open（開放，白底可點）／closed（已關閉，灰底仍可點回開放）。
 * 過去日期（早於今天，以日為單位）一律視為 disabled：灰底、擋點擊，`dayHeaderTop` 也會收到
 * `isPast` 讓頁面同步停用自己的欄頭內容（例如整天公休的 Checkbox）。
 * `cellEvents` 回傳的事件以 EventBlock 疊在該格上（多筆自動並排，且不擋底下格子的點擊）。
 * 週檢視的導覽、範圍標題、迷你月曆等版面由使用端（頁面）負責。
 */
export type SlotState = 'open' | 'closed';

export interface SlotEvent {
  key: string;
  title: string;
  /** 第二行（例如「教練 · 3 人」）。 */
  subText?: string;
  tone?: EventTone;
  /** 有值時方塊可點（例如點課堂移除）；省略則方塊 `pointerEvents:none`，不擋底下格子。 */
  onClick?: () => void;
}

interface SlotPickerProps {
  /** 要顯示的日期欄，通常是一週七天。 */
  dates: Dayjs[];
  /** 起始小時，預設 10。 */
  startHour?: number;
  /** 結束小時（不含），預設 22（列為 10:00–21:00 共 12）。 */
  endHour?: number;
  /** 一小時列高（px），預設 44。 */
  hourHeight?: number;
  cellState: (date: Dayjs, hour: number) => SlotState;
  onCellClick?: (date: Dayjs, hour: number) => void;
  /**
   * 回傳 true 的格子以灰底 disabled 呈現、擋點擊（過去日期一律 disabled，此為額外條件）。
   * 例：團體課程排程日曆用來把 time_slots 已關閉的時段標成不可開課。
   */
  cellDisabled?: (date: Dayjs, hour: number) => boolean;
  /** 該格要疊上的事件（reservations／courses 等）。回傳空陣列表示不疊。 */
  cellEvents?: (date: Dayjs, hour: number) => SlotEvent[];
  /**
   * 疊在欄頭日期列「上方」的一列，每個日期各一格（例如整天公休的 Checkbox）。省略則不顯示。
   * `isPast` 表示該日期早於今天，頁面可據此停用自己放的內容。
   */
  dayHeaderTop?: (date: Dayjs, isPast: boolean) => ReactNode;
  /** 是否顯示「現在時間」指示線／標籤，預設 `true`。 */
  showNowIndicator?: boolean;
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
const AXIS_WIDTH = 56;

export default function SlotPicker({
  dates,
  startHour = 10,
  endHour = 22,
  hourHeight = 44,
  cellState,
  onCellClick,
  cellDisabled,
  cellEvents,
  dayHeaderTop,
  showNowIndicator = true,
}: SlotPickerProps) {
  const { token } = theme.useToken();
  const today = dayjs();
  const nowMinutes = today.hour() * 60 + today.minute();
  const nowInRange = nowMinutes >= startHour * 60 && nowMinutes < endHour * 60;
  const showNow = showNowIndicator && nowInRange && dates.some((d) => d.isSame(today, 'day'));

  const hours: number[] = [];
  for (let h = startHour; h < endHour; h++) hours.push(h);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 640 }}>
        {dayHeaderTop ? (
          <div style={{ display: 'flex' }}>
            <div style={{ width: AXIS_WIDTH, flex: 'none' }} />
            {dates.map((d, i) => (
              <div
                key={d.format('YYYY-MM-DD')}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'center',
                  padding: '6px 0',
                  borderLeft: i === 0 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                  background: token.colorFillAlter,
                }}
              >
                {dayHeaderTop(d, d.isBefore(today, 'day'))}
              </div>
            ))}
          </div>
        ) : null}

        {/* 欄頭列（不隨時間格捲動） */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <div style={{ width: AXIS_WIDTH, flex: 'none' }} />
          {dates.map((d, i) => (
            <DayHeaderCell
              key={d.format('YYYY-MM-DD')}
              dow={'星期' + WEEKDAY[d.day()]}
              label={`${d.month() + 1}/${d.date()}`}
              isToday={d.isSame(today, 'day')}
              isWeekend={d.day() === 0 || d.day() === 6}
              first={i === 0}
            />
          ))}
        </div>

        {/* 時間格 */}
        <div style={{ display: 'flex', position: 'relative' }}>
          <TimeAxis
            startHour={startHour}
            endHour={endHour}
            hourHeight={hourHeight}
            width={AXIS_WIDTH}
            hideHour={showNow ? Math.floor(nowMinutes / 60) : null}
          />
          {dates.map((d, i) => {
            const isToday = d.isSame(today, 'day');
            const isPast = d.isBefore(today, 'day');
            return (
              <div
                key={d.format('YYYY-MM-DD')}
                style={{
                  flex: 1,
                  minWidth: 0,
                  position: 'relative',
                  borderLeft: i === 0 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                {hours.map((h) => {
                  const state = cellState(d, h);
                  return (
                    <TimeSlotCell
                      key={h}
                      height={hourHeight}
                      first={h === startHour}
                      closed={state === 'closed'}
                      disabled={isPast || (cellDisabled?.(d, h) ?? false)}
                      onClick={onCellClick ? () => onCellClick(d, h) : undefined}
                    />
                  );
                })}
                {hours.flatMap((h) => {
                  const evs = cellEvents?.(d, h) ?? [];
                  return evs.map((ev, idx) => (
                    <EventBlock
                      key={ev.key}
                      title={ev.title}
                      timeText={ev.subText}
                      tone={ev.tone}
                      top={(h - startHour) * hourHeight + 1}
                      height={hourHeight - 3}
                      colIndex={idx}
                      colCount={evs.length}
                      onClick={
                        ev.onClick
                          ? (e) => {
                              e.stopPropagation();
                              ev.onClick!();
                            }
                          : undefined
                      }
                      style={ev.onClick ? undefined : { pointerEvents: 'none' }}
                    />
                  ));
                })}
                {showNow && isToday ? (
                  <NowIndicator minutes={nowMinutes} hourHeight={hourHeight} startHour={startHour} />
                ) : null}
              </div>
            );
          })}
          {showNow ? (
            <NowIndicator
              minutes={nowMinutes}
              hourHeight={hourHeight}
              startHour={startHour}
              showLabel
              showLine={false}
              labelWidth={AXIS_WIDTH - 8}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

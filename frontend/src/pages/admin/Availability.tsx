import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Card, Typography, Button, Space, Checkbox, Select, theme, message } from 'antd';
import { LeftOutlined, RightOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import SlotPicker, { type SlotState, type SlotEvent } from '../../components/SlotPicker';
import { MiniCalendar } from '../../components/calendar/MiniCalendar';
import { listTimeSlots, upsertTimeSlot } from '../../api/timeSlots';
import { listReservations } from '../../api/reservations';
import { listCourses } from '../../api/courses';
import { listCoaches } from '../../api/coaches';
import { listProducts } from '../../api/products';
import { isoWeekday, buildOverrideMap, resolveAvailability } from '../../lib/availability';
import { weekdayShort } from '../../lib/weekday';
import { usePageActionBar } from '../../store/pageActionBar';

/**
 * 公休與時段設定：對應「公休設定」。「快速設定」是批次寫入的便利工具，按「套用」會把
 * 符合條件的每個日期整天標記為關閉，寫進跟「本週時段」格子同一份 draftOverrides 草稿；
 * 套用後仍可在下方時段格個別調整開放／關閉，以最後一次點擊為準——本來就是同一份資料，
 * 後動作自然覆蓋前動作，不需要額外的優先順序邏輯。逐格點擊／套用快速設定都不會立即
 * 呼叫 API；按「確定」才整批送出，「取消」則捨棄草稿還原為伺服器現況——比照 sticky
 * 儲存列的既有慣例（MemberDetail／CoachForm）。
 */
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
const START_HOUR = 10;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const DURATION_OPTIONS = [
  { value: 1, label: '一個月' },
  { value: 2, label: '兩個月' },
  { value: 3, label: '三個月' },
];
const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((v) => ({ value: v, label: '星期' + weekdayShort(v) }));
/** 時段範圍選單的邊界值：10:00…22:00 共 13 個整點，供「從」「至」兩個下拉共用。 */
const HOUR_BOUNDARY_OPTIONS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i).map((h) => ({
  value: h,
  label: `${h}:00`,
}));

interface QuickSetRow {
  /** 純本地用的暫定 id，不對應任何伺服器資料。 */
  id: number;
  day_of_week: number;
  duration_months: number;
  /** 時段範圍（含起訖），預設整天 10:00–22:00。 */
  start_hour: number;
  end_hour: number;
}

interface DraftOverride {
  slot_date: string;
  start_hour: number;
  is_open: boolean;
}

function mondayOf(d: Dayjs): Dayjs {
  return d.startOf('day').subtract((d.day() + 6) % 7, 'day');
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 從今天起，往後 durationMonths 個月內，每一次符合 dayOfWeek 的日期。 */
function targetDates(dayOfWeek: number, durationMonths: number): Dayjs[] {
  const end = dayjs().add(durationMonths, 'month');
  let d = dayjs();
  while (isoWeekday(d) !== dayOfWeek) d = d.add(1, 'day');
  const dates: Dayjs[] = [];
  while (!d.isAfter(end, 'day')) {
    dates.push(d);
    d = d.add(7, 'day');
  }
  return dates;
}

export default function Availability() {
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const [weekAnchor, setWeekAnchor] = useState(() => dayjs());
  const [miniAnchor, setMiniAnchor] = useState(() => dayjs());
  const [quickSetRows, setQuickSetRows] = useState<QuickSetRow[]>([]);
  const [draftOverrides, setDraftOverrides] = useState<Map<string, DraftOverride>>(new Map());
  const nextTempId = useRef(-1);

  const goWeek = (next: Dayjs) => {
    setWeekAnchor(next);
    setMiniAnchor(next);
  };

  const { data: slots, isLoading: slotsLoading } = useQuery({ queryKey: ['time-slots'], queryFn: listTimeSlots });
  const { data: reservations } = useQuery({ queryKey: ['reservations'], queryFn: () => listReservations() });
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: listCourses });
  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: listProducts });

  const serverOverridesByKey = buildOverrideMap(slots);
  const overridesByKey = new Map(serverOverridesByKey);
  draftOverrides.forEach((v, k) => overridesByKey.set(k, v.is_open));

  const coachNameById = new Map((coaches ?? []).map((c) => [c.id, c.name]));
  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));

  const dirty = draftOverrides.size > 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(Array.from(draftOverrides.values()).map((o) => upsertTimeSlot(o)));
    },
    onSuccess: () => {
      message.success('已儲存');
      queryClient.invalidateQueries({ queryKey: ['time-slots'] });
      setDraftOverrides(new Map());
      setQuickSetRows([]);
    },
    onError: () => message.error('儲存失敗，請稍後再試'),
  });

  const resetDrafts = () => {
    setDraftOverrides(new Map());
    setQuickSetRows([]);
  };

  const addQuickSetRow = () => {
    const id = nextTempId.current--;
    setQuickSetRows((prev) =>
      prev.concat({ id, day_of_week: 1, duration_months: 1, start_hour: START_HOUR, end_hour: END_HOUR }),
    );
  };
  const patchQuickSetRow = (
    id: number,
    patch: Partial<Pick<QuickSetRow, 'day_of_week' | 'duration_months' | 'start_hour' | 'end_hour'>>,
  ) => {
    setQuickSetRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const removeQuickSetRow = (id: number) => {
    setQuickSetRows((prev) => prev.filter((r) => r.id !== id));
  };
  const applyQuickSet = (row: QuickSetRow) => {
    const hours = HOURS.filter((h) => h >= row.start_hour && h < row.end_hour);
    if (hours.length === 0) {
      message.error('時段範圍不正確，「至」須晚於「從」');
      return;
    }
    setDraftOverrides((prev) => {
      const next = new Map(prev);
      targetDates(row.day_of_week, row.duration_months).forEach((d) => {
        hours.forEach((hour) => {
          next.set(`${d.format('YYYY-MM-DD')}-${hour}`, {
            slot_date: d.format('YYYY-MM-DD'),
            start_hour: hour,
            is_open: false,
          });
        });
      });
      return next;
    });
    message.success('已套用，尚未儲存');
  };

  const monday = mondayOf(weekAnchor);
  const weekDates = Array.from({ length: 7 }, (_, i) => monday.add(i, 'day'));
  const sunday = weekDates[6];

  const cellState = (date: Dayjs, hour: number): SlotState =>
    resolveAvailability(date, hour, overridesByKey) === 'open' ? 'open' : 'closed';

  const toggleSlot = (date: Dayjs, hour: number) => {
    const avail = resolveAvailability(date, hour, overridesByKey);
    const key = `${date.format('YYYY-MM-DD')}-${hour}`;
    setDraftOverrides((prev) => {
      const next = new Map(prev);
      next.set(key, { slot_date: date.format('YYYY-MM-DD'), start_hour: hour, is_open: avail !== 'open' });
      return next;
    });
  };

  const isDayFullyClosed = (date: Dayjs) => HOURS.every((h) => cellState(date, h) !== 'open');

  const toggleDay = (date: Dayjs, checked: boolean) => {
    setDraftOverrides((prev) => {
      const next = new Map(prev);
      HOURS.forEach((hour) => {
        const avail = resolveAvailability(date, hour, overridesByKey);
        const isOpen = avail === 'open';
        if (checked && isOpen) {
          next.set(`${date.format('YYYY-MM-DD')}-${hour}`, {
            slot_date: date.format('YYYY-MM-DD'),
            start_hour: hour,
            is_open: false,
          });
        } else if (!checked && !isOpen) {
          next.set(`${date.format('YYYY-MM-DD')}-${hour}`, {
            slot_date: date.format('YYYY-MM-DD'),
            start_hour: hour,
            is_open: true,
          });
        }
      });
      return next;
    });
  };

  const cellEvents = (date: Dayjs, hour: number): SlotEvent[] => {
    if (cellState(date, hour) === 'open') return [];
    const dateKey = date.format('YYYY-MM-DD');

    const courseEvents: SlotEvent[] = (courses ?? [])
      .filter((c) => c.day_of_week === isoWeekday(date) && c.start_hour === hour)
      .map((c) => ({
        key: `c${c.id}`,
        title: c.name,
        subText: `${coachNameById.get(c.coach_id) ?? '—'} · 上限 ${c.max_capacity}`,
        tone: 'purple',
      }));

    const reservationEvents: SlotEvent[] = (reservations ?? [])
      .filter(
        (r) =>
          r.booking_date === dateKey &&
          r.start_hour === hour &&
          r.course_id === null &&
          (r.status === '待確認' || r.status === '已確認'),
      )
      .map((r) => ({
        key: `r${r.id}`,
        title: productNameById.get(r.product_id) ?? `商品 #${r.product_id}`,
        subText: `${r.coach_id ? (coachNameById.get(r.coach_id) ?? '—') : '—'} · ${r.people_count} 人`,
        tone: r.status === '待確認' ? 'gold' : 'blue',
      }));

    return [...courseEvents, ...reservationEvents];
  };

  const rangeTitle =
    `${monday.format('YYYY/M/D')}(${WEEKDAY[monday.day()]}) – ` +
    `${sunday.format('YYYY/M/D')}(${WEEKDAY[sunday.day()]})`;

  const legend: Array<{ label: string; swatch: CSSProperties }> = [
    { label: '開放中', swatch: { background: '#fff', border: `1px solid ${token.colorBorder}` } },
    { label: '已關閉', swatch: { background: token.volcano2 } },
  ];

  // 純文字總覽：本週每日已關閉的時段，合併連續小時為區間，用「, 」串接，句尾接一次「已關閉」。
  const summaryLines = weekDates.reduce<string[]>((lines, d) => {
    const closedHours = HOURS.filter((h) => cellState(d, h) !== 'open');
    if (closedHours.length === 0) return lines;
    const dateLabel = `${d.format('M/D')}(${WEEKDAY[d.day()]})`;
    if (closedHours.length === HOURS.length) {
      lines.push(`${dateLabel}：全天已關閉`);
      return lines;
    }
    const ranges: string[] = [];
    let start = closedHours[0];
    let prev = closedHours[0];
    closedHours.slice(1).forEach((h) => {
      if (h === prev + 1) {
        prev = h;
        return;
      }
      ranges.push(`${pad(start)}:00–${pad(prev + 1)}:00`);
      start = h;
      prev = h;
    });
    ranges.push(`${pad(start)}:00–${pad(prev + 1)}:00`);
    lines.push(`${dateLabel}：${ranges.join(', ')}已關閉`);
    return lines;
  }, []);

  usePageActionBar(
    <>
      <Button onClick={resetDrafts} disabled={!dirty || saveMutation.isPending}>
        取消
      </Button>
      <Button type="primary" disabled={!dirty} loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
        確定
      </Button>
    </>,
  );

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          公休與時段設定
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          逐格點擊可切換某「日期＋時段」的開放／關閉，僅套用於該日期；勾選日期欄頭的「公休」可整日切換。
          上方「快速設定」可批次套用到多個日期，套用後仍可在下方時段格個別調整，以最後一次點擊為準。
          過去日期不可設定。關閉後會員與管理員皆無法在該時段建立預約。
        </Typography.Paragraph>
      </div>

      <Card title="快速設定" loading={slotsLoading}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 14,
            background: token.colorFillQuaternary,
            borderRadius: token.borderRadius,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>批次關閉</div>
            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
              選擇星期、時段範圍與往後幾個月，按「套用」會把範圍內每個符合的日期在指定時段標記為關閉（預設整天，寫入下方本週時段的例外設定）。
            </div>
          </div>

          {quickSetRows.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                padding: '10px 12px',
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadius,
              }}
            >
              <span style={{ fontSize: 12, color: token.colorTextQuaternary, width: 44 }}>設定 {i + 1}</span>
              <span style={{ fontSize: 14, color: token.colorTextSecondary }}>星期</span>
              <Select
                size="small"
                style={{ width: 100 }}
                options={WEEKDAY_OPTIONS}
                value={r.day_of_week}
                onChange={(v) => patchQuickSetRow(r.id, { day_of_week: v })}
              />
              <span style={{ fontSize: 14, color: token.colorTextSecondary }}>時段</span>
              <Select
                size="small"
                style={{ width: 90 }}
                options={HOUR_BOUNDARY_OPTIONS.filter((o) => o.value < r.end_hour)}
                value={r.start_hour}
                onChange={(v) => patchQuickSetRow(r.id, { start_hour: v })}
              />
              <span style={{ fontSize: 14, color: token.colorTextSecondary }}>至</span>
              <Select
                size="small"
                style={{ width: 90 }}
                options={HOUR_BOUNDARY_OPTIONS.filter((o) => o.value > r.start_hour)}
                value={r.end_hour}
                onChange={(v) => patchQuickSetRow(r.id, { end_hour: v })}
              />
              <span style={{ fontSize: 14, color: token.colorTextSecondary }}>重複</span>
              <Select
                size="small"
                style={{ width: 100 }}
                options={DURATION_OPTIONS}
                value={r.duration_months}
                onChange={(v) => patchQuickSetRow(r.id, { duration_months: v })}
              />
              <Button size="small" onClick={() => applyQuickSet(r)}>
                套用
              </Button>
              <div style={{ flex: 1 }} />
              <DeleteOutlined
                onClick={() => removeQuickSetRow(r.id)}
                style={{ cursor: 'pointer', color: token.colorTextQuaternary, fontSize: 16 }}
              />
            </div>
          ))}

          <div
            onClick={addQuickSetRow}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: 8,
              border: `1px dashed ${token.colorBorder}`,
              borderRadius: token.borderRadius,
              fontSize: 14,
              color: token.colorTextSecondary,
              cursor: 'pointer',
              background: token.colorBgContainer,
            }}
          >
            <PlusOutlined />
            <span>新增一列快速設定</span>
          </div>
        </div>
      </Card>

      <Card title="本週時段" extra={rangeTitle} loading={slotsLoading}>
        <Space style={{ marginBottom: 12 }} wrap>
          <Button icon={<LeftOutlined />} onClick={() => goWeek(weekAnchor.subtract(1, 'week'))}>
            上一週
          </Button>
          <Button icon={<RightOutlined />} onClick={() => goWeek(weekAnchor.add(1, 'week'))}>
            下一週
          </Button>
          <Button onClick={() => goWeek(dayjs())}>回到本週</Button>
        </Space>

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ width: 216, flex: 'none', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <MiniCalendar
              year={miniAnchor.year()}
              month={miniAnchor.month()}
              todayKey={dayjs().format('YYYY-MM-DD')}
              selectedKeys={weekDates.map((d) => d.format('YYYY-MM-DD'))}
              onSelect={(_, date) => goWeek(dayjs(date))}
              onPrev={() => setMiniAnchor((m) => m.subtract(1, 'month'))}
              onNext={() => setMiniAnchor((m) => m.add(1, 'month'))}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                圖例
              </Typography.Text>
              {legend.map((l) => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, flex: 'none', ...l.swatch }} />
                  <span>{l.label}</span>
                </div>
              ))}
            </div>
            <div>
              <Typography.Text strong style={{ fontSize: 13 }}>
                {rangeTitle} 關閉時段總覽
              </Typography.Text>
              <div style={{ marginTop: 4, fontSize: 12, color: token.colorTextTertiary, lineHeight: 1.6 }}>
                僅列出本週已關閉的時段，供設定前確認，不影響其他週。
              </div>
              {summaryLines.length === 0 ? (
                <div style={{ marginTop: 8, fontSize: 13, color: token.colorTextTertiary }}>本週目前皆為開放時段。</div>
              ) : (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {summaryLines.map((line) => (
                    <div key={line} style={{ fontSize: 13 }}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <SlotPicker
              dates={weekDates}
              cellState={cellState}
              onCellClick={toggleSlot}
              cellEvents={cellEvents}
              showNowIndicator={false}
              dayHeaderTop={(d, isPast) => (
                <Checkbox checked={isDayFullyClosed(d)} disabled={isPast} onChange={(e) => toggleDay(d, e.target.checked)}>
                  公休
                </Checkbox>
              )}
            />
          </div>
        </div>
      </Card>
    </Space>
  );
}

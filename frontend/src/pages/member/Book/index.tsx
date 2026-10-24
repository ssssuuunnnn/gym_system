import { useState } from 'react';
import { App, Segmented, Select, Skeleton, theme } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import { listSchedule, type ScheduleSession } from '../../../api/courses';
import { listCoaches } from '../../../api/coaches';
import { listProducts } from '../../../api/products';
import { listPurchases, type Purchase } from '../../../api/purchases';
import { createReservation } from '../../../api/reservations';
import { getSettings } from '../../../api/settings';
import { listTimeSlots } from '../../../api/timeSlots';
import { buildOverrideMap, isoWeekday, resolveAvailability } from '../../../lib/availability';
import { weekdayLabel } from '../../../lib/weekday';
import { decodeUserId, useAuthStore } from '../../../store/auth';
import FrontPageHeader from '../../../components/member/FrontPageHeader';
import FrontCard from '../../../components/member/FrontCard';
import { DateStrip } from './components/DateStrip';
import { SessionCard } from './components/SessionCard';
import { ConfirmSheet } from './components/ConfirmSheet';
import { PrivatePanel } from './components/PrivatePanel';

type Tab = '團體課' | '私人課';

/** 預約可選的天數（含今天） */
const DAYS_AHEAD = 7;
/** 私人課可預約的整點（與 time_slots 的 10–21 一致） */
const PRIVATE_HOURS = Array.from({ length: 12 }, (_, i) => 10 + i);

type Pending =
  | { kind: 'group'; session: ScheduleSession; start: Dayjs; end: Dayjs }
  | { kind: 'private'; hour: number; start: Dayjs; end: Dayjs };

function errorDetail(error: unknown, fallback: string) {
  const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
  return typeof detail === 'string' ? detail : fallback;
}

/** 方案剩餘可用：已付款且還有堂數；多個時先用最早買的（API 為新到舊） */
function usable(purchases: Purchase[], match: (p: Purchase) => boolean) {
  return purchases.filter((p) => p.payment_status === '已付款' && p.remaining_hours > 0 && match(p)).reverse();
}

/**
 * 預約課程（前台）：團體課＝日期橫條 → 當天課堂卡片 → 確認面板；私人課＝選教練 → 選時段 → 確認面板。
 * 系統自動選定要扣抵的方案（團體課：綁定該課程的方案；私人課：「課程」類方案），會員不必自己挑購買紀錄。
 */
export default function Book() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selfId = decodeUserId(useAuthStore((s) => s.token));

  const today = dayjs().startOf('day');
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => today.add(i, 'day'));
  const startKey = dates[0].format('YYYY-MM-DD');
  const endKey = dates[dates.length - 1].format('YYYY-MM-DD');

  const [tab, setTab] = useState<Tab>('團體課');
  const [date, setDate] = useState<Dayjs>(today);
  const [coachId, setCoachId] = useState<number | null>(null);
  const [privatePlanId, setPrivatePlanId] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const schedule = useQuery({ queryKey: ['schedule', startKey, endKey], queryFn: () => listSchedule(startKey, endKey) });
  const { data: purchases = [] } = useQuery({ queryKey: ['my-purchases'], queryFn: () => listPurchases() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const { data: coaches = [] } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const { data: slots } = useQuery({ queryKey: ['time-slots'], queryFn: listTimeSlots });
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSettings });

  const productById = new Map(products.map((p) => [p.id, p]));
  const now = dayjs();

  // ── 團體課 ──
  const sessionsByDate = new Map<string, ScheduleSession[]>();
  for (const s of schedule.data ?? []) {
    const start = dayjs(s.session_date).add(s.start_minute, 'minute');
    if (start.isBefore(now)) continue; // 已開始的課不再開放預約
    const list = sessionsByDate.get(s.session_date) ?? [];
    list.push(s);
    sessionsByDate.set(s.session_date, list);
  }
  const countByDate = new Map([...sessionsByDate].map(([d, list]) => [d, list.length]));
  const daySessions = sessionsByDate.get(date.format('YYYY-MM-DD')) ?? [];
  const groupPlanFor = (s: ScheduleSession) => usable(purchases, (p) => productById.get(p.product_id)?.course_id === s.course_id)[0];

  // ── 私人課 ──
  const privatePlans = usable(purchases, (p) => productById.get(p.product_id)?.category === '課程');
  const privatePlan = privatePlans.find((p) => p.id === privatePlanId) ?? privatePlans[0];
  const privateCoaches = coaches.filter((c) => c.coach_types.includes('私人教練'));
  const overrides = buildOverrideMap(slots);
  const hours = PRIVATE_HOURS.map((hour) => ({
    hour,
    disabled: resolveAvailability(date, hour, overrides) === 'closed' || date.hour(hour).isBefore(now),
  }));

  const planLabel = (p: Purchase | undefined) => (p ? `${productById.get(p.product_id)?.name ?? '方案'} · 剩 ${p.remaining_hours} 堂` : null);

  const book = useMutation({
    mutationFn: (p: Pending) => {
      const plan = p.kind === 'group' ? groupPlanFor(p.session) : privatePlan;
      if (!plan) throw new Error('沒有可用的方案');
      return createReservation(
        {
          member_id: selfId ?? 0,
          product_id: plan.product_id,
          purchase_id: plan.id,
          course_id: p.kind === 'group' ? p.session.course_id : null,
          coach_id: p.kind === 'group' ? null : coachId,
          booking_date: p.start.format('YYYY-MM-DD'),
          start_hour: p.start.hour(),
          people_count: 1,
          notes: null,
        },
        false,
      );
    },
    onSuccess: () => {
      message.success('已送出預約，工作室確認後會顯示「已確認」');
      setPending(null);
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['my-purchases'] });
    },
    onError: (e) => message.error(errorDetail(e, e instanceof Error ? e.message : '預約失敗，請稍後再試')),
  });

  const sheetPlan = pending ? (pending.kind === 'group' ? groupPlanFor(pending.session) : privatePlan) : undefined;
  const pendingCoach = pending?.kind === 'private' ? coaches.find((c) => c.id === coachId) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FrontPageHeader title="預約課程" />

      <Segmented<Tab> block size="large" value={tab} onChange={setTab} options={['團體課', '私人課']} />

      <DateStrip dates={dates} value={date} onChange={setDate} countByDate={tab === '團體課' ? countByDate : undefined} />

      <p style={{ margin: 0, fontSize: 14, color: token.colorTextSecondary }}>
        {date.format('M 月 D 日')} {weekdayLabel(isoWeekday(date)).replace('週', '星期')}
        {tab === '團體課' && !schedule.isLoading ? ` · ${daySessions.length} 堂團體課` : ''}
      </p>

      {tab === '團體課' ? (
        schedule.isLoading ? (
          <FrontCard>
            <Skeleton active />
          </FrontCard>
        ) : daySessions.length === 0 ? (
          <FrontCard style={{ textAlign: 'center', padding: 24, color: token.colorTextSecondary }}>這天沒有團體課，換一天看看</FrontCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {daySessions.map((s) => {
              const start = dayjs(s.session_date).add(s.start_minute, 'minute');
              return (
                <SessionCard
                  key={`${s.course_id}-${s.session_date}-${s.start_minute}`}
                  session={s}
                  active={pending?.kind === 'group' && pending.session === s}
                  onBook={() => setPending({ kind: 'group', session: s, start, end: start.add(s.duration_minutes, 'minute') })}
                />
              );
            })}
          </div>
        )
      ) : (
        <PrivatePanel
          coaches={privateCoaches}
          coachId={coachId}
          onCoachChange={setCoachId}
          hours={hours}
          onPickHour={(hour) => {
            const start = date.hour(hour).minute(0);
            setPending({ kind: 'private', hour, start, end: start.add(1, 'hour') });
          }}
        />
      )}

      <ConfirmSheet
        open={pending !== null}
        title={pending?.kind === 'group' ? pending.session.course_name : '私人課'}
        subtitle={pending?.kind === 'group' ? pending.session.coach_name : pendingCoach ? pendingCoach.alias || pendingCoach.name : ''}
        start={pending?.start ?? null}
        end={pending?.end ?? null}
        coverSrc={pending?.kind === 'group' ? pending.session.cover_image_url : null}
        planLabel={planLabel(sheetPlan)}
        planPicker={
          pending?.kind === 'private' && privatePlans.length > 1 ? (
            <Select
              aria-label="選擇要使用的方案"
              style={{ width: '100%' }}
              value={privatePlan?.id}
              onChange={setPrivatePlanId}
              options={privatePlans.map((p) => ({ value: p.id, label: planLabel(p) }))}
            />
          ) : undefined
        }
        deadlineHours={settings?.cancel_deadline_hours}
        submitting={book.isPending}
        onConfirm={() => pending && book.mutate(pending)}
        onClose={() => setPending(null)}
        onBuy={() => navigate('/member/purchase')}
      />
    </div>
  );
}

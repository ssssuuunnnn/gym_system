import { App, Button, Skeleton, theme } from 'antd';
import { ClockCircleOutlined, GiftOutlined, RightOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import { listPurchases } from '../../../api/purchases';
import { listMyCoupons } from '../../../api/coupons';
import { cancelReservation, listReservations, markAttendance } from '../../../api/reservations';
import { getSettings } from '../../../api/settings';
import { useAuthStore } from '../../../store/auth';
import { classEnd, classStart } from '../../../lib/booking';
import { isoWeekday } from '../../../lib/availability';
import { weekdayLabel } from '../../../lib/weekday';
import { useBookingLookups } from '../../../lib/useBookingLookups';
import FrontPageHeader from '../../../components/member/FrontPageHeader';
import FrontCard from '../../../components/member/FrontCard';
import { PlanCard } from './components/PlanCard';
import { NextClassCard } from './components/NextClassCard';
import { UpcomingRow } from './components/UpcomingRow';

function greeting(hour: number) {
  if (hour < 11) return '早安';
  if (hour < 18) return '午安';
  return '晚安';
}

function errorDetail(error: unknown, fallback: string) {
  const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
  return typeof detail === 'string' ? detail : fallback;
}

/**
 * 會員首頁（前台）：剩餘堂數、待付款提醒、下一堂課（簽到／取消）、接下來的預約。
 * 設計稿見「健身工作室前台設計稿」的「會員｜首頁」。
 */
export default function MemberHome() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { username } = useAuthStore();
  const now = dayjs();

  const purchases = useQuery({ queryKey: ['my-purchases'], queryFn: () => listPurchases() });
  const reservations = useQuery({ queryKey: ['my-reservations'], queryFn: () => listReservations() });
  const coupons = useQuery({ queryKey: ['my-coupons'], queryFn: listMyCoupons });
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSettings });
  const lookups = useBookingLookups();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
    queryClient.invalidateQueries({ queryKey: ['my-purchases'] });
  };

  const checkIn = useMutation({
    mutationFn: (id: number) => markAttendance(id, '已出席'),
    onSuccess: () => {
      message.success('簽到成功，祝上課愉快');
      refresh();
    },
    onError: (e) => message.error(errorDetail(e, '簽到失敗，請稍後再試')),
  });
  const cancel = useMutation({
    mutationFn: (id: number) => cancelReservation(id),
    onSuccess: (r) => {
      message.success(r.late_cancel ? '已取消（期限內取消，這堂不退回）' : '已取消，堂數已退回');
      refresh();
    },
    onError: (e) => message.error(errorDetail(e, '取消失敗，請稍後再試')),
  });

  // 方案：已付款、有堂數且還有剩（API 依新到舊排序）
  const plans = (purchases.data ?? []).filter((p) => p.payment_status === '已付款' && p.total_hours > 0 && p.remaining_hours > 0);
  const unpaid = (purchases.data ?? []).filter((p) => p.payment_status === '待付款');
  // 還沒使用的體驗券（ADR 0010）
  const trials = (coupons.data ?? []).filter((c) => c.kind === '體驗券' && c.status === '可使用');
  const plan = plans[0];

  // 接下來：待確認／已確認、還沒下課的預約，依開課時間排序
  const upcoming = (reservations.data ?? [])
    .filter((r) => (r.status === '待確認' || r.status === '已確認') && classEnd(r, lookups.describe(r).durationMinutes).isAfter(now))
    .sort((a, b) => classStart(a).valueOf() - classStart(b).valueOf());
  const [next, ...later] = upcoming;

  const loading = purchases.isLoading || reservations.isLoading || lookups.isLoading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FrontPageHeader
        eyebrow={`${now.format('M 月 D 日')} ${weekdayLabel(isoWeekday(now)).replace('週', '星期')}`}
        title={`${greeting(now.hour())}，${username ?? ''}`}
      />

      {loading ? (
        <FrontCard>
          <Skeleton active />
        </FrontCard>
      ) : (
        <>
          <PlanCard
            plan={plan}
            planName={plan ? lookups.productById.get(plan.product_id)?.name ?? '方案' : ''}
            otherPlanCount={Math.max(plans.length - 1, 0)}
          />

          {trials.length > 0 && (
            <Link
              to="/member/coupons"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 14,
                background: token.purple1,
                color: token.purple7,
                textDecoration: 'none',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <GiftOutlined aria-hidden="true" style={{ fontSize: 18 }} />
              <span style={{ flex: 1 }}>
                你有 {trials.length} 張體驗券（{trials[0].summary}），使用後就能預約
              </span>
              <RightOutlined aria-hidden="true" style={{ fontSize: 12 }} />
            </Link>
          )}

          {unpaid.length > 0 && (
            <Link
              to="/member/products"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 14,
                background: token.colorWarningBg,
                color: token.colorWarningText,
                textDecoration: 'none',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <ClockCircleOutlined aria-hidden="true" style={{ fontSize: 18 }} />
              <span style={{ flex: 1 }}>
                {unpaid.length === 1
                  ? `${lookups.productById.get(unpaid[0].product_id)?.name ?? '訂單'}（NT$ ${unpaid[0].amount.toLocaleString('zh-TW')}）待付款`
                  : `${unpaid.length} 筆訂單待付款`}
                ，向櫃台付款後堂數入帳
              </span>
              <RightOutlined aria-hidden="true" style={{ fontSize: 12 }} />
            </Link>
          )}

          {next ? (
            <NextClassCard
              reservation={next}
              info={lookups.describe(next)}
              deadlineHours={settings?.cancel_deadline_hours}
              onCheckIn={() => checkIn.mutate(next.id)}
              onCancel={() => cancel.mutate(next.id)}
              checkingIn={checkIn.isPending}
              cancelling={cancel.isPending}
            />
          ) : (
            <FrontCard style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>目前沒有預約</span>
              <span style={{ fontSize: 13, color: token.colorTextSecondary }}>看看這週有哪些課，挑一堂開始吧</span>
              <Link to="/member/book">
                <Button type="primary" size="large" style={{ fontWeight: 700, minWidth: 160 }}>
                  預約課程
                </Button>
              </Link>
            </FrontCard>
          )}

          {later.length > 0 && (
            <section aria-labelledby="later-title" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 id="later-title" style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                  接下來
                </h2>
                <Link to="/member/bookings" style={{ fontSize: 13, fontWeight: 500 }}>
                  全部 ›
                </Link>
              </div>
              {later.slice(0, 3).map((r) => (
                <UpcomingRow key={r.id} reservation={r} info={lookups.describe(r)} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

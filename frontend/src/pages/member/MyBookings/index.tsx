import { useMemo, useRef, useState } from 'react';
import { App, Button, Empty, Popconfirm, Skeleton, theme } from 'antd';
import { CalendarOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import { useAuthStore } from '../../../store/auth';
import { listReservations, cancelReservation, markAttendance, type Reservation } from '../../../api/reservations';
import { getSettings } from '../../../api/settings';
import { classEnd, classStart, hasStarted, isLateCancel, selfCheckInOpen } from '../../../lib/booking';
import { googleCalendarUrl } from '../../../lib/calendarLink';
import { getTenantProfile } from '../../../api/tenant';
import { isoWeekday } from '../../../lib/availability';
import { weekdayLabel } from '../../../lib/weekday';
import { useBookingLookups } from '../../../lib/useBookingLookups';
import { useTerms } from '../../../lib/terms';
import FrontPageHeader from '../../../components/member/FrontPageHeader';
import FrontCard from '../../../components/member/FrontCard';
import { WeekStrip } from './components/WeekStrip';
import { BookingCard, isInactive } from './components/BookingCard';
import EditBookingModal from './components/EditBookingModal';

/** 這天所在那週的週一 */
function mondayOf(d: Dayjs) {
  return d.startOf('day').subtract(isoWeekday(d) - 1, 'day');
}

function errorDetail(error: unknown, fallback: string) {
  const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
  return typeof detail === 'string' ? detail : fallback;
}

/**
 * 我的預約（前台，手機優先）：上方週列（有預約的日子有小圓點、可前後換週），下方依日期列出這週的預約卡片，
 * 像手機行事曆的「日程」檢視。卡片上直接簽到、修改（待確認）、取消；已取消／未成立的預設收起。
 * 後端依登入身份只回自己的預約。取消期限：已確認的預約在開始前 N 小時內取消不退回，取消前會提示。
 */
export default function MyBookings() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { t } = useTerms();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isCoach } = useAuthStore();
  const lookups = useBookingLookups();
  const [weekStart, setWeekStart] = useState(() => mondayOf(dayjs()));
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const dayRefs = useRef(new Map<string, HTMLElement>());

  const reservations = useQuery({ queryKey: ['my-reservations'], queryFn: () => listReservations() });
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSettings });
  const deadlineHours = settings?.cancel_deadline_hours;
  const { data: profile } = useQuery({ queryKey: ['tenant-profile'], queryFn: getTenantProfile, staleTime: 5 * 60_000 });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
    queryClient.invalidateQueries({ queryKey: ['my-purchases'] });
  };
  const cancel = useMutation({
    mutationFn: (id: number) => cancelReservation(id),
    onSuccess: (r) => {
      message.success(r.late_cancel ? `已取消（期限內取消，這 1 ${t.unit}不退回）` : `已取消，${t.hours}已退回`);
      refresh();
    },
    onError: (e) => message.error(errorDetail(e, '取消失敗，請稍後再試')),
  });
  const checkIn = useMutation({
    mutationFn: (id: number) => markAttendance(id, '已出席'),
    onSuccess: () => {
      message.success(`${t.checkIn}成功`);
      refresh();
    },
    onError: (e) => message.error(errorDetail(e, `${t.checkIn}失敗，請稍後再試`)),
  });

  const all = useMemo(
    () =>
      [...(reservations.data ?? [])].sort(
        (a, b) => a.booking_date.localeCompare(b.booking_date) || a.start_hour - b.start_hour,
      ),
    [reservations.data],
  );
  const weekEnd = weekStart.add(7, 'day');
  const inWeek = all.filter((r) => {
    const d = dayjs(r.booking_date);
    return !d.isBefore(weekStart) && d.isBefore(weekEnd);
  });
  const hiddenCount = inWeek.filter(isInactive).length;
  const visible = showInactive ? inWeek : inWeek.filter((r) => !isInactive(r));

  // 週列的小圓點：只算有效的預約
  const countByDate = new Map<string, number>();
  for (const r of all) {
    if (isInactive(r)) continue;
    countByDate.set(r.booking_date, (countByDate.get(r.booking_date) ?? 0) + 1);
  }

  const byDay = new Map<string, Reservation[]>();
  for (const r of visible) byDay.set(r.booking_date, [...(byDay.get(r.booking_date) ?? []), r]);

  // 這週之後的下一筆有效預約（「之後還有」與空白週用）
  const later = all.filter((r) => !isInactive(r) && !dayjs(r.booking_date).isBefore(weekEnd));
  const nextLater = later[0];

  const pickDay = (d: Dayjs) => {
    const el = dayRefs.current.get(d.format('YYYY-MM-DD'));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else message.info(`${d.format('M/D')} 沒有預約`);
  };

  const actionsFor = (r: Reservation) => {
    const info = lookups.describe(r);
    const buttons = [];
    if (r.status === '已確認' && !r.attendance && selfCheckInOpen(r, info.durationMinutes)) {
      buttons.push(
        <Button key="checkin" type="primary" loading={checkIn.isPending && checkIn.variables === r.id} onClick={() => checkIn.mutate(r.id)}>
          {t.checkIn}
        </Button>,
      );
    }
    if (r.status === '待確認') {
      buttons.push(
        <Button key="edit" autoInsertSpace={false} onClick={() => setEditing(r)}>
          修改
        </Button>,
      );
    }
    if ((r.status === '待確認' || (r.status === '已確認' && !hasStarted(r))) && !r.attendance) {
      const late = r.status === '已確認' && isLateCancel(r, deadlineHours);
      buttons.push(
        <Popconfirm
          key="cancel"
          title="取消這筆預約？"
          description={late ? `已在開始前 ${deadlineHours} 小時內，取消後這 1 ${t.unit}不會退回。` : `${t.hours}會退回。`}
          okText={late ? '仍要取消' : '取消預約'}
          okButtonProps={{ danger: true }}
          cancelText="不取消"
          onConfirm={() => cancel.mutateAsync(r.id)}
        >
          <Button danger type="text">
            取消預約
          </Button>
        </Popconfirm>,
      );
    }
    // 已確認、還沒結束的預約可以加到 Google 日曆（待確認的可能不會成立，先不給）
    if (r.status === '已確認' && !r.attendance && !classEnd(r, info.durationMinutes).isBefore()) {
      const shopName = profile?.name ?? '';
      const url = googleCalendarUrl({
        title: shopName ? `${info.title}｜${shopName}` : info.title,
        start: classStart(r),
        end: classEnd(r, info.durationMinutes),
        timezone: profile?.timezone ?? 'Asia/Taipei',
        location: info.branchAddress ?? [shopName, info.branchName].filter(Boolean).join(' '),
        details: [
          info.coachName ? `${t.staff}：${info.coachName}` : null,
          r.people_count > 1 ? `人數：${r.people_count} 人` : null,
          `查看或取消預約：${window.location.origin}/member/bookings`,
        ]
          .filter(Boolean)
          .join('\n'),
      });
      buttons.push(
        <Button key="calendar" type="text" icon={<CalendarOutlined />} href={url} target="_blank" rel="noopener noreferrer">
          加入行事曆
        </Button>,
      );
    }
    if (isCoach && r.status === '已確認') {
      buttons.push(
        <Button key="addon" type="text" onClick={() => navigate(`/member/bookings/${r.id}/add-person`)}>
          加購臨時加人
        </Button>,
      );
    }
    return buttons.length ? buttons : undefined;
  };

  const today = dayjs();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FrontPageHeader
        title="我的預約"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/member/book')}>
            預約
          </Button>
        }
      />

      <FrontCard padding="12px 8px">
        <WeekStrip weekStart={weekStart} onWeekChange={(d) => setWeekStart(mondayOf(d))} countByDate={countByDate} onPickDay={pickDay} />
      </FrontCard>

      {reservations.isLoading || lookups.isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : byDay.size === 0 ? (
        <FrontCard style={{ textAlign: 'center' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={hiddenCount ? '這週的預約都已取消' : '這週沒有預約'}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button type="primary" onClick={() => navigate('/member/book')}>
                去預約
              </Button>
              {nextLater && (
                <Button onClick={() => setWeekStart(mondayOf(dayjs(nextLater.booking_date)))}>
                  下一筆：{dayjs(nextLater.booking_date).format('M/D')}
                </Button>
              )}
            </div>
          </Empty>
        </FrontCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[...byDay.entries()].map(([date, list]) => {
            const d = dayjs(date);
            const isToday = d.isSame(today, 'day');
            return (
              <section
                key={date}
                ref={(el) => {
                  if (el) dayRefs.current.set(date, el);
                  else dayRefs.current.delete(date);
                }}
                aria-label={d.format('M 月 D 日')}
                style={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr)', gap: 10, scrollMarginTop: 16 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                  <span style={{ fontSize: 12, color: isToday ? token.colorPrimary : token.colorTextSecondary }}>
                    {isToday ? '今天' : weekdayLabel(isoWeekday(d))}
                  </span>
                  <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, color: isToday ? token.colorPrimary : token.colorText }}>
                    {d.date()}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {list.map((r) => (
                    <BookingCard key={r.id} reservation={r} info={lookups.describe(r)} actions={actionsFor(r)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {hiddenCount > 0 && byDay.size > 0 && (
        <Button type="link" onClick={() => setShowInactive((v) => !v)} style={{ alignSelf: 'center' }}>
          {showInactive ? '收起已取消的預約' : `顯示已取消／未成立（${hiddenCount}）`}
        </Button>
      )}

      {later.length > 0 && byDay.size > 0 && (
        <button
          type="button"
          onClick={() => {
            setWeekStart(mondayOf(dayjs(nextLater.booking_date)));
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          style={{
            border: 'none',
            background: token.colorBgContainer,
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 14,
            color: token.colorText,
          }}
        >
          <span style={{ flex: 1, textAlign: 'left' }}>
            之後還有 {later.length} 筆預約
            <span style={{ color: token.colorTextSecondary }}>
              ・下一筆 {classStart(nextLater).format('M/D HH:mm')}
            </span>
          </span>
          <RightOutlined style={{ fontSize: 12, color: token.colorTextSecondary }} />
        </button>
      )}

      <EditBookingModal reservation={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

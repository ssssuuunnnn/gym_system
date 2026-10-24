import { useState } from 'react';
import { App, Skeleton, theme } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import { getMyCoachProfile } from '../../../api/coaches';
import { listCoachingReservations, markAttendance, type Attendance, type CoachingReservation } from '../../../api/reservations';
import { CHECK_IN_OPENS_BEFORE_MINUTES, classStart } from '../../../lib/booking';
import { isoWeekday } from '../../../lib/availability';
import { weekdayLabel } from '../../../lib/weekday';
import { useBookingLookups } from '../../../lib/useBookingLookups';
import FrontPageHeader from '../../../components/member/FrontPageHeader';
import FrontCard from '../../../components/member/FrontCard';
import { ClassUnitCard, type ClassUnit } from './components/ClassUnitCard';

function errorDetail(error: unknown, fallback: string) {
  const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
  return typeof detail === 'string' ? detail : fallback;
}

/**
 * 教練今日課表（前台，教練主題）：今天由我帶的課，依時間排序；團體課同一堂合併成一張卡、展開學員名單簽到。
 * 上方三格：今日課程、今日學員、本月已帶（已標記出席狀態的堂數，與鐘點計算的「一堂」一致）。
 */
export default function CoachToday() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const now = dayjs();

  const { data: reservations, isLoading } = useQuery({ queryKey: ['coaching-reservations'], queryFn: listCoachingReservations });
  const { data: profile } = useQuery({ queryKey: ['my-coach-profile'], queryFn: getMyCoachProfile });
  const lookups = useBookingLookups();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const mark = useMutation({
    mutationFn: ({ id, attendance }: { id: number; attendance: Attendance }) => markAttendance(id, attendance),
    onSuccess: (r) => {
      message.success(`已標記${r.attendance}`);
      queryClient.invalidateQueries({ queryKey: ['coaching-reservations'] });
    },
    onError: (e) => message.error(errorDetail(e, '標記失敗，請稍後再試')),
  });

  const unitKey = (r: CoachingReservation) =>
    r.course_id != null ? `c${r.course_id}-${r.booking_date}-${r.start_hour}` : `r${r.id}`;

  const toUnits = (list: CoachingReservation[]): ClassUnit[] => {
    const units = new Map<string, ClassUnit>();
    for (const r of list) {
      const key = unitKey(r);
      const info = lookups.describe(r);
      const unit = units.get(key);
      if (unit) unit.reservations.push(r);
      else {
        const start = classStart(r);
        units.set(key, { key, start, end: start.add(info.durationMinutes, 'minute'), title: info.title, isGroup: info.isGroup, reservations: [r] });
      }
    }
    return [...units.values()].sort((a, b) => a.start.valueOf() - b.start.valueOf());
  };

  const all = reservations ?? [];
  const todayUnits = toUnits(all.filter((r) => dayjs(r.booking_date).isSame(now, 'day')));
  const todayMembers = new Set(all.filter((r) => dayjs(r.booking_date).isSame(now, 'day')).map((r) => r.member_id)).size;
  const monthTaught = toUnits(all.filter((r) => r.attendance !== null && dayjs(r.booking_date).isSame(now, 'month'))).length;
  const nextUnit = toUnits(all.filter((r) => classStart(r).isAfter(now.endOf('day'))))[0];

  // 預設展開：已開放簽到且（上課中或還有人沒標記）；其餘可點擊切換
  const isExpanded = (u: ClassUnit) => {
    if (u.key in toggled) return toggled[u.key];
    const opened = !now.isBefore(u.start.subtract(CHECK_IN_OPENS_BEFORE_MINUTES, 'minute'));
    return opened && (now.isBefore(u.end) || u.reservations.some((r) => r.attendance === null));
  };

  const initial = (profile?.alias || profile?.name || '教').charAt(0).toUpperCase();

  const stat = (value: number, unit: string, label: string) => (
    <FrontCard padding={12} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
        {value}
        <span style={{ fontSize: 13, fontWeight: 500 }}> {unit}</span>
      </span>
      <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{label}</span>
    </FrontCard>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FrontPageHeader
        eyebrow={`${now.format('M 月 D 日')} ${weekdayLabel(isoWeekday(now)).replace('週', '星期')}`}
        title="今日課表"
        extra={
          <div
            role="img"
            aria-label={`${profile?.alias || profile?.name || ''}，${profile?.coach_types.join('、') ?? '教練'}`}
            style={{
              width: 44,
              height: 44,
              flex: 'none',
              borderRadius: 22,
              background: token.colorPrimary,
              color: token.colorTextLightSolid,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 17,
            }}
          >
            {initial}
          </div>
        }
      />

      {isLoading || lookups.isLoading ? (
        <FrontCard>
          <Skeleton active />
        </FrontCard>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            {stat(todayUnits.length, '堂', '今日課程')}
            {stat(todayMembers, '位', '今日學員')}
            {stat(monthTaught, '堂', '本月已帶')}
          </div>

          {todayUnits.length === 0 ? (
            <FrontCard style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 24, textAlign: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>今天沒有課</span>
              <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
                {nextUnit ? `下一堂：${nextUnit.start.format('M/D HH:mm')} ${nextUnit.title}` : '目前沒有已確認的預約'}
              </span>
            </FrontCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {todayUnits.map((u) => (
                <ClassUnitCard
                  key={u.key}
                  unit={u}
                  expanded={isExpanded(u)}
                  onToggle={() => setToggled((t) => ({ ...t, [u.key]: !isExpanded(u) }))}
                  onMark={(id, attendance) => mark.mutate({ id, attendance })}
                  markingId={mark.isPending ? mark.variables?.id : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

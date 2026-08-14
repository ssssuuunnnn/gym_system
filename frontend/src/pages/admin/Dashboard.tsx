import { Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { listMembers } from '../../api/users';
import { listReservations } from '../../api/reservations';
import { listCourses } from '../../api/courses';
import StatCard from '../../components/StatCard';
import PendingReservationsCard from '../../components/PendingReservationsCard';
import CourseWeekdayChart from '../../components/CourseWeekdayChart';
import NewMemberTrendChart from '../../components/NewMemberTrendChart';

const WEEKDAY_LABELS = ['週一', '週二', '週三', '週四', '週五', '週六'];

/**
 * 管理員儀表板：彙整會員／預約審核／課程統計，皆為前端計算，不新增後端 API。
 * day_of_week 沿用 SlotPicker 的慣例：1＝週一…6＝週六。
 */
export default function Dashboard() {
  const { data: members, isLoading: membersLoading } = useQuery({ queryKey: ['members'], queryFn: listMembers });
  const { data: reservations, isLoading: reservationsLoading } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => listReservations(),
  });
  const { data: courses, isLoading: coursesLoading } = useQuery({ queryKey: ['courses'], queryFn: listCourses });

  if (membersLoading || reservationsLoading || coursesLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  const memberNameById = new Map((members ?? []).map((m) => [m.id, m.username]));
  const memberCount = (members ?? []).filter((m) => m.role === 'member').length;

  const pendingReservations = (reservations ?? []).filter((r) => r.status === '待確認');

  const courseCount = (courses ?? []).length;
  const courseWeekdayData = WEEKDAY_LABELS.map((label, idx) => {
    const dayOfWeek = idx + 1;
    return { label, value: (courses ?? []).filter((c) => c.day_of_week === dayOfWeek).length };
  });

  const today = dayjs().startOf('day');
  const newMemberTrendData = Array.from({ length: 7 }, (_, i) => {
    const day = today.subtract(6 - i, 'day');
    const count = (members ?? []).filter((m) => dayjs(m.created_at).isSame(day, 'day')).length;
    return { label: day.format('M/D'), value: count };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <StatCard title="會員總數" value={memberCount} suffix=" 人" />
        </div>
        <div style={{ flex: 1 }}>
          <StatCard title="待審核預約" value={pendingReservations.length} suffix=" 筆" />
        </div>
        <div style={{ flex: 1 }}>
          <StatCard title="課程總數" value={courseCount} suffix=" 堂" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <CourseWeekdayChart data={courseWeekdayData} />
        </div>
        <div style={{ flex: 1 }}>
          <NewMemberTrendChart data={newMemberTrendData} />
        </div>
      </div>

      <PendingReservationsCard
        reservations={pendingReservations.map((r) => ({
          id: r.id,
          member_id: r.member_id,
          booking_date: r.booking_date,
          start_hour: r.start_hour,
          created_at: r.created_at,
        }))}
        memberNameById={memberNameById}
      />
    </div>
  );
}

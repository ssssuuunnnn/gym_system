import { Card, Typography, Table, Button, Statistic } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import StatusTag from '../../components/StatusTag';
import { listReservations, type Reservation } from '../../api/reservations';
import { listPurchases } from '../../api/purchases';
import { listMembers } from '../../api/users';
import { listProducts } from '../../api/products';
import { listCoaches } from '../../api/coaches';
import { listCourses } from '../../api/courses';
import { useTerms } from '../../lib/terms';

type ScheduleRow = {
  key: string;
  type: '固定課程' | '預約';
  start_hour: number;
  name: string;
  coach_id: number | null;
  extra: string;
};

/**
 * 管理員儀表板：登入後首頁，取代原本直接跳轉到預約審核列表的行為。
 * 對應 gym-system-design/ADMIN_DASHBOARD_SPEC.md。
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTerms();
  const today = dayjs();
  const todayStr = today.format('YYYY-MM-DD');
  const todayDow = today.day(); // 0=週日...6=週六，與 courses.day_of_week（1-6，週日無資料）同軸

  const { data: reservations, isLoading: reservationsLoading } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => listReservations(),
  });
  const { data: purchases } = useQuery({ queryKey: ['purchases'], queryFn: () => listPurchases() });
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: listCourses });

  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const coachNameById = new Map((coaches ?? []).map((c) => [c.id, c.name]));
  const usernameByMemberId = new Map((members ?? []).map((m) => [m.id, m.username]));

  const todayReservations = (reservations ?? []).filter((r) => r.booking_date === todayStr);
  const pendingReservations = (reservations ?? []).filter((r) => r.status === '待確認');
  const todayRevenue = (purchases ?? [])
    .filter((p) => p.purchase_date === todayStr)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const todayCourses =
    todayDow === 0
      ? []
      : (courses ?? []).filter((c) => c.weekdays.includes(todayDow) && c.start_hour != null);

  const scheduleRows: ScheduleRow[] = [
    ...todayCourses.map((c) => ({
      key: `course-${c.id}`,
      type: '固定課程' as const,
      start_hour: c.start_hour ?? 0,
      name: c.name,
      coach_id: c.coach_id,
      extra: `上限 ${c.max_capacity} 人`,
    })),
    ...todayReservations
      .filter((r) => r.course_id === null)
      .map((r) => ({
        key: `reservation-${r.id}`,
        type: '預約' as const,
        start_hour: r.start_hour,
        name: productNameById.get(r.product_id) ?? `#${r.product_id}`,
        coach_id: r.coach_id,
        extra: `${r.people_count} 人．${r.status}`,
      })),
  ].sort((a, b) => a.start_hour - b.start_hour);

  const scheduleColumns: ColumnsType<ScheduleRow> = [
    { title: '時段', dataIndex: 'start_hour', render: (h: number) => `${h}:00` },
    { title: '類型', dataIndex: 'type' },
    { title: '名稱', dataIndex: 'name' },
    {
      title: t.staff,
      dataIndex: 'coach_id',
      render: (coachId: number | null) => (coachId ? coachNameById.get(coachId) ?? `#${coachId}` : '—'),
    },
    { title: '備註', dataIndex: 'extra' },
  ];

  const pendingColumns: ColumnsType<Reservation> = [
    {
      title: '預約日期',
      key: 'time',
      render: (_, record) => `${dayjs(record.booking_date).format('MM-DD')} ${record.start_hour}:00`,
    },
    {
      title: '會員',
      dataIndex: 'member_id',
      render: (memberId: number) => usernameByMemberId.get(memberId) ?? `#${memberId}`,
    },
    {
      title: '商品',
      dataIndex: 'product_id',
      render: (productId: number) => productNameById.get(productId) ?? `#${productId}`,
    },
    { title: '狀態', dataIndex: 'status', render: (status: string) => <StatusTag status={status} /> },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        儀表板
      </Typography.Title>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Card style={{ flex: '1 1 200px' }}>
          <Statistic title="今日預約數" value={todayReservations.length} suffix="筆" />
        </Card>
        <Card
          style={{ flex: '1 1 200px', cursor: 'pointer' }}
          onClick={() => navigate('/admin/reservations')}
        >
          <Statistic title="待審核預約數" value={pendingReservations.length} suffix="筆" />
        </Card>
        <Card style={{ flex: '1 1 200px' }}>
          <Statistic
            title="今日營收"
            value={todayRevenue}
            formatter={(value) => `NT$ ${Number(value).toLocaleString()}`}
          />
        </Card>
        <Card style={{ flex: '1 1 200px' }}>
          <Statistic title="會員總數" value={(members ?? []).length} suffix="人" />
        </Card>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Card title={`今日${t.service}與時段`} style={{ flex: '2 1 480px' }} loading={reservationsLoading}>
          <Table
            rowKey="key"
            size="small"
            columns={scheduleColumns}
            dataSource={scheduleRows}
            pagination={false}
            locale={{ emptyText: todayDow === 0 ? `今日無排定${t.service}` : '今日尚無排程' }}
          />
        </Card>
        <Card
          title="待審核預約"
          style={{ flex: '1 1 320px' }}
          extra={
            <Button size="small" onClick={() => navigate('/admin/reservations')}>
              查看全部
            </Button>
          }
        >
          <Table rowKey="id" size="small" columns={pendingColumns} dataSource={pendingReservations.slice(0, 8)} pagination={false} />
        </Card>
      </div>
    </div>
  );
}

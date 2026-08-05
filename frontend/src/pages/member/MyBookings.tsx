import { Card, Typography, Table, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import StatusTag from '../../components/StatusTag';
import { useAuthStore } from '../../store/auth';
import { listReservations, type Reservation } from '../../api/reservations';
import { listProducts } from '../../api/products';
import { listCoaches } from '../../api/coaches';
import { listCourses } from '../../api/courses';

/**
 * 我的預約列表：對應「我的預約列表」。後端依登入身份自動篩選為自己的預約，
 * 不接受查詢他人資料。加購臨時加人 (3b) 僅場租教練身份、且預約已確認時可用。
 */
export default function MyBookings() {
  const navigate = useNavigate();
  const { isCoach } = useAuthStore();

  const { data: reservations, isLoading } = useQuery({ queryKey: ['my-reservations'], queryFn: () => listReservations() });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: listCourses });

  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const coachNameById = new Map((coaches ?? []).map((c) => [c.id, c.name]));
  const courseNameById = new Map((courses ?? []).map((c) => [c.id, c.name]));

  const columns: ColumnsType<Reservation> = [
    {
      title: '預約日期',
      key: 'time',
      render: (_, record) => `${dayjs(record.booking_date).format('YYYY-MM-DD')} ${record.start_hour}:00`,
    },
    {
      title: '商品',
      dataIndex: 'product_id',
      render: (productId: number) => productNameById.get(productId) ?? `#${productId}`,
    },
    {
      title: '教練',
      dataIndex: 'coach_id',
      render: (coachId: number | null) => (coachId ? coachNameById.get(coachId) ?? `#${coachId}` : '—'),
    },
    {
      title: '課程',
      dataIndex: 'course_id',
      render: (courseId: number | null) => (courseId ? courseNameById.get(courseId) ?? `#${courseId}` : '—'),
    },
    { title: '人數', dataIndex: 'people_count' },
    {
      title: '狀態',
      dataIndex: 'status',
      render: (status: string) => <StatusTag status={status} />,
    },
    ...(isCoach
      ? [
          {
            title: '操作',
            key: 'actions',
            render: (_: unknown, record: Reservation) =>
              record.status === '已確認' ? (
                <Button size="small" onClick={() => navigate(`/member/bookings/${record.id}/add-person`)}>
                  加購臨時加人
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          我的預約列表
        </Typography.Title>
        <Button type="primary" onClick={() => navigate('/member/bookings/submit')}>
          送出預約申請
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={reservations}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
}

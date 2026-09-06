import { useState } from 'react';
import { Card, Typography, Table, Button, Popconfirm, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import StatusTag from '../../../components/StatusTag';
import { useAuthStore } from '../../../store/auth';
import { listReservations, cancelReservation, type Reservation } from '../../../api/reservations';
import { listProducts } from '../../../api/products';
import { listCourses } from '../../../api/courses';
import WeekCalendar from './components/WeekCalendar';
import EditBookingModal from './components/EditBookingModal';

/**
 * 我的預約：本週課表週檢視 + 預約清單。後端依登入身份自動篩選為自己的預約，
 * 不接受查詢他人資料。編輯／取消僅限自己的預約；加購臨時加人 (3b) 僅場租教練
 * 身份、且預約已確認時可用。
 */
export default function MyBookings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isCoach } = useAuthStore();
  const [editing, setEditing] = useState<Reservation | null>(null);

  const { data: reservations, isLoading } = useQuery({ queryKey: ['my-reservations'], queryFn: () => listReservations() });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: listCourses });

  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const courseNameById = new Map((courses ?? []).map((c) => [c.id, c.name]));
  const courseDurationById = new Map((courses ?? []).map((c) => [c.id, c.duration_minutes]));

  const cancelMutation = useMutation({
    mutationFn: cancelReservation,
    onSuccess: () => {
      message.success('已取消預約');
      queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
    },
    onError: (error) => {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      message.error(detail || '取消失敗，請稍後再試');
    },
  });

  const columns: ColumnsType<Reservation> = [
    {
      title: '日期',
      dataIndex: 'booking_date',
      render: (bookingDate: string) => dayjs(bookingDate).format('YYYY-MM-DD'),
    },
    {
      title: '時段',
      dataIndex: 'start_hour',
      render: (startHour: number) => `${startHour}:00`,
    },
    {
      title: '課程名稱',
      key: 'name',
      render: (_, record) =>
        (record.course_id && courseNameById.get(record.course_id)) ?? productNameById.get(record.product_id) ?? '—',
    },
    {
      title: '狀態',
      dataIndex: 'status',
      render: (status: string) => <StatusTag status={status} />,
    },
    {
      title: '預約建立時間',
      dataIndex: 'created_at',
      render: (createdAt: string) => dayjs(createdAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8 }}>
          {record.status === '待確認' ? (
            <Button size="small" type="link" onClick={() => setEditing(record)}>
              編輯
            </Button>
          ) : null}
          {record.status === '待確認' || record.status === '已確認' ? (
            <Popconfirm
              title="確定要取消此預約？"
              onConfirm={() => cancelMutation.mutate(record.id)}
            >
              <Button size="small" type="link" danger>
                取消
              </Button>
            </Popconfirm>
          ) : null}
          {isCoach && record.status === '已確認' ? (
            <Button size="small" onClick={() => navigate(`/member/bookings/${record.id}/add-person`)}>
              加購臨時加人
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          我的預約
        </Typography.Title>
        <Button type="primary" onClick={() => navigate('/member/bookings/submit')}>
          新增預約
        </Button>
      </div>

      <Card>
        <WeekCalendar
          reservations={reservations ?? []}
          courseNameById={courseNameById}
          productNameById={productNameById}
          courseDurationById={courseDurationById}
        />
      </Card>

      <Card title="預約清單" extra={`共 ${reservations?.length ?? 0} 筆`}>
        <Table rowKey="id" columns={columns} dataSource={reservations} loading={isLoading} pagination={{ pageSize: 10 }} />
      </Card>

      <EditBookingModal reservation={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

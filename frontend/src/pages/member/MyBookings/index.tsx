import { useState } from 'react';
import { Card, Typography, Table, Button, Popconfirm, Space, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import StatusTag from '../../../components/StatusTag';
import { useAuthStore } from '../../../store/auth';
import { listReservations, cancelReservation, markAttendance, type Reservation } from '../../../api/reservations';
import { getSettings } from '../../../api/settings';
import { hasStarted, isLateCancel, selfCheckInOpen } from '../../../lib/booking';
import { formatServerTime } from '../../../lib/datetime';
import { listProducts } from '../../../api/products';
import { listCourses } from '../../../api/courses';
import WeekCalendar from './components/WeekCalendar';
import EditBookingModal from './components/EditBookingModal';

/**
 * 我的預約：本週課表週檢視 + 預約清單。後端依登入身份自動篩選為自己的預約，
 * 不接受查詢他人資料。編輯／取消僅限自己的預約；加購臨時加人 (3b) 僅場租教練
 * 身份、且預約已確認時可用。
 *
 * 取消期限：已確認的預約在開課前 N 小時內（系統設定）取消不退堂，取消前會提示。
 * 簽到：開課前 30 分鐘到下課之間，可為自己的已確認預約簽到。
 */
export default function MyBookings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isCoach } = useAuthStore();
  const [editing, setEditing] = useState<Reservation | null>(null);

  const { data: reservations, isLoading } = useQuery({ queryKey: ['my-reservations'], queryFn: () => listReservations() });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: listCourses });
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSettings });
  const deadlineHours = settings?.cancel_deadline_hours;

  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const courseNameById = new Map((courses ?? []).map((c) => [c.id, c.name]));
  const courseDurationById = new Map((courses ?? []).map((c) => [c.id, c.duration_minutes]));

  const errorDetail = (error: unknown, fallback: string) =>
    (isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined) || fallback;

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelReservation(id),
    onSuccess: (reservation) => {
      message.success(reservation.late_cancel ? '已取消預約（期限內取消，堂數不退回）' : '已取消預約');
      queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['my-purchases'] });
    },
    onError: (error) => {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      message.error(detail || '取消失敗，請稍後再試');
    },
  });

  const checkInMutation = useMutation({
    mutationFn: (id: number) => markAttendance(id, '已出席'),
    onSuccess: () => {
      message.success('簽到成功');
      queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
    },
    onError: (error) => message.error(errorDetail(error, '簽到失敗，請稍後再試')),
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
      render: (status: string, record) => (
        <Space size={4}>
          <StatusTag status={status} />
          {record.late_cancel && <StatusTag status="晚取消" />}
          {record.attendance && <StatusTag status={record.attendance} />}
        </Space>
      ),
    },
    {
      title: '預約建立時間',
      dataIndex: 'created_at',
      render: (createdAt: string) => formatServerTime(createdAt),
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
          {record.status === '已確認' &&
          !record.attendance &&
          selfCheckInOpen(record, record.course_id ? courseDurationById.get(record.course_id) : undefined) ? (
            <Button
              size="small"
              type="primary"
              loading={checkInMutation.isPending && checkInMutation.variables === record.id}
              onClick={() => checkInMutation.mutate(record.id)}
            >
              簽到
            </Button>
          ) : null}
          {(record.status === '待確認' || (record.status === '已確認' && !hasStarted(record))) &&
          !record.attendance ? (
            <Popconfirm
              title="確定要取消此預約？"
              description={
                isLateCancel(record, deadlineHours)
                  ? `已在開課前 ${deadlineHours} 小時內，取消後這堂不會退回。`
                  : undefined
              }
              okText={isLateCancel(record, deadlineHours) ? '仍要取消' : '確定'}
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

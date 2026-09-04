import { Card, Typography, Table, Button, Space, Popconfirm, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import StatusTag from '../../components/StatusTag';
import { listReservations, reviewReservation, cancelReservation, type Reservation } from '../../api/reservations';
import { listMembers } from '../../api/users';
import { listProducts } from '../../api/products';
import { listCoaches } from '../../api/coaches';
import { listCourses } from '../../api/courses';

/**
 * 預約審核列表：對應「預約審核列表」。管理員可看全部預約，並對待確認項目核准／拒絕，
 * 對已確認項目取消。
 */
export default function BookingReviewList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: reservations, isLoading } = useQuery({ queryKey: ['reservations'], queryFn: () => listReservations() });
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: listCourses });

  const usernameByMemberId = new Map((members ?? []).map((m) => [m.id, m.username]));
  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const coachNameById = new Map((coaches ?? []).map((c) => [c.id, c.name]));
  const courseNameById = new Map((courses ?? []).map((c) => [c.id, c.name]));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['reservations'] });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: '已確認' | '已拒絕' }) => reviewReservation(id, status),
    onSuccess: () => {
      message.success('已更新預約狀態');
      invalidate();
    },
    onError: () => message.error('操作失敗，請稍後再試'),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelReservation,
    onSuccess: () => {
      message.success('已取消預約');
      invalidate();
    },
    onError: () => message.error('取消失敗，請稍後再試'),
  });

  const columns: ColumnsType<Reservation> = [
    {
      title: '預約日期',
      key: 'time',
      render: (_, record) => `${dayjs(record.booking_date).format('YYYY-MM-DD')} ${record.start_hour}:00`,
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
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/admin/reservations/${record.id}`)}>
            詳情
          </Button>
          {record.status === '待確認' && (
            <>
              <Button
                size="small"
                type="primary"
                loading={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ id: record.id, status: '已確認' })}
              >
                核准
              </Button>
              <Popconfirm
                title="確定要拒絕這筆預約申請？"
                onConfirm={() => reviewMutation.mutate({ id: record.id, status: '已拒絕' })}
              >
                <Button size="small" danger>
                  拒絕
                </Button>
              </Popconfirm>
            </>
          )}
          {record.status === '已確認' && (
            <Popconfirm title="確定要取消這筆預約？" onConfirm={() => cancelMutation.mutate(record.id)}>
              <Button size="small" danger loading={cancelMutation.isPending}>
                取消
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          預約審核列表
        </Typography.Title>
        <Button type="primary" onClick={() => navigate('/admin/reservations/create')}>
          管理員建立預約
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

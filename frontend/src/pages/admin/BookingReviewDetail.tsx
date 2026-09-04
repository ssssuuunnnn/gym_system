import { Card, Typography, Descriptions, Button, Space, Popconfirm, message, Skeleton, Result } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import StatusTag from '../../components/StatusTag';
import { listReservations, reviewReservation, cancelReservation, type ReservationSource } from '../../api/reservations';
import { listMembers } from '../../api/users';
import { listProducts } from '../../api/products';
import { listCoaches } from '../../api/coaches';
import { listCourses } from '../../api/courses';
import { listPurchases } from '../../api/purchases';

const SOURCE_LABEL: Record<ReservationSource, string> = {
  member_submitted: '會員自行送出',
  admin_created: '管理員建立',
};

/**
 * 預約審核詳情：對應「預約審核列表/詳情」。後端無 GET /reservations/{id}，
 * 從既有列表快取中依 id 找出該筆資料（同 ProductForm 編輯模式的作法）。
 */
export default function BookingReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const reservationId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: reservations, isLoading } = useQuery({ queryKey: ['reservations'], queryFn: () => listReservations() });
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: listCourses });
  const { data: purchases } = useQuery({ queryKey: ['purchases'], queryFn: () => listPurchases() });

  const reservation = reservations?.find((r) => r.id === reservationId);

  const usernameByMemberId = new Map((members ?? []).map((m) => [m.id, m.username]));
  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const coachNameById = new Map((coaches ?? []).map((c) => [c.id, c.name]));
  const courseNameById = new Map((courses ?? []).map((c) => [c.id, c.name]));
  const purchaseById = new Map((purchases ?? []).map((p) => [p.id, p]));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['reservations'] });

  const reviewMutation = useMutation({
    mutationFn: (status: '已確認' | '已拒絕') => reviewReservation(reservationId, status),
    onSuccess: () => {
      message.success('已更新預約狀態');
      invalidate();
    },
    onError: () => message.error('操作失敗，請稍後再試'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelReservation(reservationId),
    onSuccess: () => {
      message.success('已取消預約');
      invalidate();
    },
    onError: () => message.error('取消失敗，請稍後再試'),
  });

  if (isLoading) {
    return (
      <Card>
        <Skeleton active />
      </Card>
    );
  }

  if (!reservation) {
    return (
      <Card>
        <Result
          status="404"
          title="找不到此預約"
          extra={
            <Button type="primary" onClick={() => navigate('/admin/reservations')}>
              返回審核列表
            </Button>
          }
        />
      </Card>
    );
  }

  const purchase = reservation.purchase_id ? purchaseById.get(reservation.purchase_id) : undefined;

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          預約審核詳情 #{reservation.id}
        </Typography.Title>
        <Button onClick={() => navigate('/admin/reservations')}>返回審核列表</Button>
      </div>

      <Descriptions bordered column={2} size="middle">
        <Descriptions.Item label="狀態">
          <StatusTag status={reservation.status} />
        </Descriptions.Item>
        <Descriptions.Item label="來源">{SOURCE_LABEL[reservation.source]}</Descriptions.Item>

        <Descriptions.Item label="會員">
          {usernameByMemberId.get(reservation.member_id) ?? `#${reservation.member_id}`}
        </Descriptions.Item>
        <Descriptions.Item label="商品">
          {productNameById.get(reservation.product_id) ?? `#${reservation.product_id}`}
        </Descriptions.Item>

        <Descriptions.Item label="教練">
          {reservation.coach_id ? coachNameById.get(reservation.coach_id) ?? `#${reservation.coach_id}` : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="課程">
          {reservation.course_id ? courseNameById.get(reservation.course_id) ?? `#${reservation.course_id}` : '—'}
        </Descriptions.Item>

        <Descriptions.Item label="預約日期">{dayjs(reservation.booking_date).format('YYYY-MM-DD')}</Descriptions.Item>
        <Descriptions.Item label="時段">{reservation.start_hour}:00</Descriptions.Item>

        <Descriptions.Item label="人數">{reservation.people_count}</Descriptions.Item>
        <Descriptions.Item label="關聯購買紀錄">
          {purchase ? `#${purchase.id}｜剩餘 ${purchase.remaining_hours} 堂` : '—'}
        </Descriptions.Item>

        <Descriptions.Item label="備註" span={2}>
          {reservation.notes || '—'}
        </Descriptions.Item>

        <Descriptions.Item label="建立時間">
          {dayjs(reservation.created_at).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
        <Descriptions.Item label="審核人">
          {reservation.reviewed_by ? usernameByMemberId.get(reservation.reviewed_by) ?? `#${reservation.reviewed_by}` : '—'}
        </Descriptions.Item>

        <Descriptions.Item label="審核時間">
          {reservation.reviewed_at ? dayjs(reservation.reviewed_at).format('YYYY-MM-DD HH:mm') : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="取消時間">
          {reservation.cancelled_at ? dayjs(reservation.cancelled_at).format('YYYY-MM-DD HH:mm') : '—'}
        </Descriptions.Item>
      </Descriptions>

      {reservation.status === '待確認' && (
        <Space style={{ marginTop: 16 }}>
          <Button
            type="primary"
            loading={reviewMutation.isPending}
            onClick={() => reviewMutation.mutate('已確認')}
          >
            核准
          </Button>
          <Popconfirm title="確定要拒絕這筆預約申請？" onConfirm={() => reviewMutation.mutate('已拒絕')}>
            <Button danger loading={reviewMutation.isPending}>
              拒絕
            </Button>
          </Popconfirm>
        </Space>
      )}

      {reservation.status === '已確認' && (
        <Space style={{ marginTop: 16 }}>
          <Popconfirm title="確定要取消這筆預約？" onConfirm={() => cancelMutation.mutate()}>
            <Button danger loading={cancelMutation.isPending}>
              取消預約
            </Button>
          </Popconfirm>
        </Space>
      )}
    </Card>
  );
}

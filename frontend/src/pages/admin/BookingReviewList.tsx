import { useState } from 'react';
import { useHighlightRow } from '../../lib/useHighlightRow';
import { Card, Typography, Table, Button, Space, Popconfirm, Modal, Radio, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import StatusTag from '../../components/StatusTag';
import { isAxiosError } from 'axios';
import {
  listReservations,
  reviewReservation,
  cancelReservation,
  markAttendance,
  type Attendance,
  type Reservation,
} from '../../api/reservations';
import { getSettings } from '../../api/settings';
import { hasStarted, isLateCancel, staffCheckInOpen } from '../../lib/booking';
import { listMembers } from '../../api/users';
import { listProducts } from '../../api/products';
import { listCoaches } from '../../api/coaches';
import { useBranches } from '../../lib/useBranches';
import { BranchPicker } from '../../components/BranchPicker';
import { listCourses } from '../../api/courses';
import { useTerms } from '../../lib/terms';

/**
 * 預約審核列表：對應「預約審核列表」。管理員可看全部預約，並對待確認項目核准／拒絕，
 * 對已確認項目取消、簽到或標記未到。
 *
 * 取消已確認的預約時，若已在取消期限內（系統設定），預設不退堂，管理員可在彈窗中改為退堂。
 * 已出席／未到皆不退堂；已標記出席狀態的預約不能取消。
 */
export default function BookingReviewList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTerms();

  const { data: reservations, isLoading } = useQuery({ queryKey: ['reservations'], queryFn: () => listReservations() });
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: listCourses });
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSettings });
  const deadlineHours = settings?.cancel_deadline_hours;
  const [lateCancelTarget, setLateCancelTarget] = useState<Reservation | null>(null);
  const [lateRefund, setLateRefund] = useState(false);
  const branchList = useBranches();
  const [branchFilter, setBranchFilter] = useState<number | null>(null);
  const rows = (reservations ?? []).filter((r) => branchFilter == null || r.branch_id === branchFilter);
  // 從鈴鐺通知點進來：跳到那一筆並加底色（?highlight=<id>）
  const highlight = useHighlightRow(rows, 10);

  const usernameByMemberId = new Map((members ?? []).map((m) => [m.id, m.username]));
  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const coachNameById = new Map((coaches ?? []).map((c) => [c.id, c.name]));
  const courseNameById = new Map((courses ?? []).map((c) => [c.id, c.name]));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['reservations'] });
    queryClient.invalidateQueries({ queryKey: ['purchases'] });
  };
  const errorDetail = (error: unknown, fallback: string) =>
    (isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined) || fallback;

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: '已確認' | '已拒絕' }) => reviewReservation(id, status),
    onSuccess: () => {
      message.success('已更新預約狀態');
      invalidate();
    },
    onError: () => message.error('操作失敗，請稍後再試'),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, refund }: { id: number; refund?: boolean }) => cancelReservation(id, refund),
    onSuccess: () => {
      message.success('已取消預約');
      setLateCancelTarget(null);
      invalidate();
    },
    onError: (error) => message.error(errorDetail(error, '取消失敗，請稍後再試')),
  });

  const attendanceMutation = useMutation({
    mutationFn: ({ id, attendance }: { id: number; attendance: Attendance }) => markAttendance(id, attendance),
    onSuccess: (r) => {
      message.success(`已標記${r.attendance}`);
      invalidate();
    },
    onError: (error) => message.error(errorDetail(error, '標記失敗，請稍後再試')),
  });

  const startCancel = (record: Reservation) => {
    if (isLateCancel(record, deadlineHours)) {
      setLateRefund(false);
      setLateCancelTarget(record);
    }
  };

  const columns: ColumnsType<Reservation> = [
    {
      title: '預約日期',
      key: 'time',
      render: (_, record) => `${dayjs(record.booking_date).format('YYYY-MM-DD')} ${record.start_hour}:00`,
    },
    {
      title: '分店',
      dataIndex: 'branch_id',
      render: (id: number) => branchList.nameOf(id),
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
      title: t.staff,
      dataIndex: 'coach_id',
      render: (coachId: number | null) => (coachId ? coachNameById.get(coachId) ?? `#${coachId}` : '—'),
    },
    {
      title: t.service,
      dataIndex: 'course_id',
      render: (courseId: number | null) => (courseId ? courseNameById.get(courseId) ?? `#${courseId}` : '—'),
    },
    { title: '人數', dataIndex: 'people_count' },
    {
      title: '狀態',
      dataIndex: 'status',
      render: (status: string, record) => (
        <Space size={4}>
          <StatusTag status={status} />
          {record.late_cancel && <StatusTag status="晚取消" />}
        </Space>
      ),
    },
    {
      title: '出席',
      dataIndex: 'attendance',
      render: (attendance: Attendance | null) => (attendance ? <StatusTag status={attendance} /> : '—'),
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
          {record.status === '已確認' && staffCheckInOpen(record) && (
            <>
              {record.attendance !== '已出席' && (
                <Button
                  size="small"
                  onClick={() => attendanceMutation.mutate({ id: record.id, attendance: '已出席' })}
                >
                  {t.checkIn}
                </Button>
              )}
              {record.attendance !== '未到' && hasStarted(record) && (
                <Popconfirm
                  title="標記為未到？"
                  description={`未到不退${t.unit}。`}
                  onConfirm={() => attendanceMutation.mutate({ id: record.id, attendance: '未到' })}
                >
                  <Button size="small">未到</Button>
                </Popconfirm>
              )}
            </>
          )}
          {record.status === '已確認' &&
            !record.attendance &&
            (isLateCancel(record, deadlineHours) ? (
              <Button size="small" danger onClick={() => startCancel(record)}>
                取消
              </Button>
            ) : (
              <Popconfirm
                title="確定要取消這筆預約？"
                onConfirm={() => cancelMutation.mutate({ id: record.id })}
              >
                <Button size="small" danger loading={cancelMutation.isPending}>
                  取消
                </Button>
              </Popconfirm>
            ))}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          預約審核列表
        </Typography.Title>
        <div style={{ flex: 1 }} />
        <BranchPicker branches={branchList.branches} value={branchFilter} onChange={setBranchFilter} allowAll />
        <Button type="primary" onClick={() => navigate('/admin/reservations/create')}>
          管理員建立預約
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={isLoading}
        pagination={highlight.pagination}
        onRow={(r) => ({ style: highlight.rowStyle(r) })}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title="期限內取消"
        open={lateCancelTarget !== null}
        okText="確認取消預約"
        okButtonProps={{ danger: true }}
        cancelText="返回"
        confirmLoading={cancelMutation.isPending}
        onOk={() => lateCancelTarget && cancelMutation.mutate({ id: lateCancelTarget.id, refund: lateRefund })}
        onCancel={() => setLateCancelTarget(null)}
      >
        <Typography.Paragraph>
          這筆預約已在開始前 {deadlineHours} 小時內，依規則取消後不退{t.unit}。
        </Typography.Paragraph>
        <Radio.Group
          value={lateRefund}
          onChange={(e) => setLateRefund(e.target.value)}
          options={[
            { value: false, label: `依規則不退${t.unit}` },
            { value: true, label: `仍退回 1 ${t.unit}（例外處理）` },
          ]}
        />
      </Modal>
    </Card>
  );
}

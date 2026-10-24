import { useState } from 'react';
import { Card, Typography, Table, Button, Space, Popconfirm, Segmented, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import StatusTag from '../../components/StatusTag';
import {
  listCoachingReservations,
  markAttendance,
  type Attendance,
  type CoachingReservation,
} from '../../api/reservations';
import { listProducts } from '../../api/products';
import { listCourses } from '../../api/courses';
import { classStart, hasStarted, staffCheckInOpen } from '../../lib/booking';

type RangeFilter = '今天' | '即將到來' | '已過去';
const RANGE_FILTERS: RangeFilter[] = ['今天', '即將到來', '已過去'];

/**
 * 學員簽到（教練，所有類型）：列出由我帶的已確認預約——預約指定我為教練，或我授課的團體課程。
 * 開課前 30 分鐘起可簽到；課程開始後可標記未到。已出席與未到皆不退堂。
 */
export default function CoachAttendance() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeFilter>('今天');

  const { data: reservations, isLoading } = useQuery({
    queryKey: ['coaching-reservations'],
    queryFn: listCoachingReservations,
  });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: listCourses });

  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const courseNameById = new Map((courses ?? []).map((c) => [c.id, c.name]));

  const today = dayjs();
  const inRange = (r: CoachingReservation) => {
    const start = classStart(r);
    if (range === '今天') return start.isSame(today, 'day');
    if (range === '即將到來') return start.isAfter(today, 'day');
    return start.isBefore(today, 'day');
  };
  const rows = (reservations ?? []).filter(inRange);
  if (range === '已過去') rows.reverse();

  const attendanceMutation = useMutation({
    mutationFn: ({ id, attendance }: { id: number; attendance: Attendance }) => markAttendance(id, attendance),
    onSuccess: (r) => {
      message.success(`已標記${r.attendance}`);
      queryClient.invalidateQueries({ queryKey: ['coaching-reservations'] });
    },
    onError: (error) => {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      message.error(detail || '標記失敗，請稍後再試');
    },
  });

  const columns: ColumnsType<CoachingReservation> = [
    {
      title: '時間',
      key: 'time',
      render: (_, r) => classStart(r).format('YYYY-MM-DD HH:mm'),
    },
    { title: '學員', dataIndex: 'member_username' },
    {
      title: '課程',
      key: 'name',
      render: (_, r) => (r.course_id && courseNameById.get(r.course_id)) ?? productNameById.get(r.product_id) ?? '—',
    },
    { title: '人數', dataIndex: 'people_count' },
    {
      title: '出席',
      dataIndex: 'attendance',
      render: (attendance: Attendance | null) => (attendance ? <StatusTag status={attendance} /> : '—'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, r) =>
        staffCheckInOpen(r) ? (
          <Space>
            {r.attendance !== '已出席' && (
              <Button
                size="small"
                type="primary"
                onClick={() => attendanceMutation.mutate({ id: r.id, attendance: '已出席' })}
              >
                簽到
              </Button>
            )}
            {r.attendance !== '未到' && hasStarted(r) && (
              <Popconfirm
                title="標記為未到？"
                description="未到不退堂。"
                onConfirm={() => attendanceMutation.mutate({ id: r.id, attendance: '未到' })}
              >
                <Button size="small">未到</Button>
              </Popconfirm>
            )}
          </Space>
        ) : (
          <Typography.Text type="secondary">開課前 30 分鐘開放簽到</Typography.Text>
        ),
    },
  ];

  return (
    <Card>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        學員簽到
      </Typography.Title>
      <Segmented<RangeFilter>
        style={{ marginBottom: 16 }}
        value={range}
        onChange={setRange}
        options={RANGE_FILTERS}
      />
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
}

import { useMemo, useState } from 'react';
import {
  Breadcrumb,
  Button,
  Card,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Popconfirm,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, SearchOutlined, PictureOutlined, InboxOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import {
  listActiveCourses,
  updateCourseStatus,
  COURSE_STATUSES,
  type Course,
  type CourseStatus,
} from '../../api/courses';
import { listCoaches } from '../../api/coaches';
import { weekdayLabel } from '../../lib/weekday';

const STATUS_TAG_COLOR: Record<CourseStatus, string> = {
  上架: 'success',
  下架: 'default',
  草稿: 'warning',
};

/**
 * 團體課程管理列表：對應 Claude Design「團體課程管理列表」設計稿。
 * 課程管理拆分為「團體課程」與「私人教練課程」，此頁為團體課程。
 */
export default function GroupCourseList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses', 'active'],
    queryFn: listActiveCourses,
  });
  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const coachNameById = useMemo(
    () => new Map((coaches ?? []).map((c) => [c.id, c.name])),
    [coaches],
  );

  const [q, setQ] = useState('');
  const [coachFilter, setCoachFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<CourseStatus | 'all'>('all');
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: CourseStatus }) => updateCourseStatus(id, status),
    onSuccess: (updated) => {
      message.success(`已將「${updated.name}」設為${updated.status}`);
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: () => {
      message.error('狀態更新失敗，請稍後再試');
    },
  });

  const all = useMemo(() => courses ?? [], [courses]);
  const total = all.length;
  const onCount = all.filter((c) => c.status === '上架').length;
  const draftCount = all.filter((c) => c.status === '草稿').length;

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    const from = range?.[0]?.format('YYYY-MM-DD');
    const to = range?.[1]?.format('YYYY-MM-DD');
    return all.filter((c) => {
      if (keyword) {
        const hit =
          c.name.toLowerCase().includes(keyword) || (c.code ?? '').toLowerCase().includes(keyword);
        if (!hit) return false;
      }
      if (coachFilter !== 'all' && c.coach_id !== coachFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (from && to) {
        if (!c.start_date || !c.end_date) return false;
        if (c.end_date < from || c.start_date > to) return false;
      }
      return true;
    });
  }, [all, q, coachFilter, statusFilter, range]);

  const resetFilters = () => {
    setQ('');
    setCoachFilter('all');
    setStatusFilter('all');
    setRange(null);
  };

  const columns: ColumnsType<Course> = [
    {
      title: '封面',
      dataIndex: 'cover_image_url',
      width: 96,
      render: (url: string | null) =>
        url ? (
          <img
            src={url}
            alt=""
            style={{ width: 88, height: 50, objectFit: 'cover', borderRadius: 6, display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: 88,
              height: 50,
              borderRadius: 6,
              background: 'rgba(0,0,0,0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(0,0,0,0.25)',
            }}
          >
            <PictureOutlined style={{ fontSize: 18 }} />
          </div>
        ),
    },
    {
      title: '課程名稱',
      dataIndex: 'name',
      width: 200,
      render: (name: string, r) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span>{name}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.code ?? '—'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '教練',
      dataIndex: 'coach_id',
      width: 96,
      render: (coachId: number) => coachNameById.get(coachId) ?? `#${coachId}`,
    },
    {
      title: '開班人數',
      key: 'capacity',
      width: 120,
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span>
            {r.min_capacity} – {r.max_capacity} 人
          </span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            已報名 {r.enrolled_count} 人
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '課程介紹',
      dataIndex: 'description',
      width: 260,
      render: (desc: string | null) => (
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 13, marginBottom: 0 }}
          ellipsis={{ rows: 2 }}
        >
          {desc || '—'}
        </Typography.Paragraph>
      ),
    },
    {
      title: '課堂數',
      dataIndex: 'session_count',
      width: 80,
      render: (n: number) => `${n} 堂`,
    },
    {
      title: '開課時間',
      key: 'period',
      width: 210,
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13 }}>
            {r.start_date && r.end_date
              ? `${dayjs(r.start_date).format('YYYY/MM/DD')} – ${dayjs(r.end_date).format('YYYY/MM/DD')}`
              : '未設定'}
          </span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.day_of_week != null && r.start_hour != null
              ? `每${weekdayLabel(r.day_of_week)} ${r.start_hour}:00 · ${r.duration_minutes} 分鐘`
              : '未設定'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      width: 76,
      render: (status: CourseStatus) => <Tag color={STATUS_TAG_COLOR[status]}>{status}</Tag>,
    },
    {
      title: '最後編輯',
      key: 'updated',
      width: 150,
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13 }}>{dayjs(r.updated_at).format('YYYY-MM-DD HH:mm')}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.updated_by_name ?? '—'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          {r.status !== '草稿' && (
            <Popconfirm
              title={`確定要${r.status === '上架' ? '下架' : '上架'}「${r.name}」？`}
              onConfirm={() =>
                statusMutation.mutate({ id: r.id, status: r.status === '上架' ? '下架' : '上架' })
              }
            >
              <Button type="link" size="small" style={{ padding: 0 }}>
                {r.status === '上架' ? '下架' : '上架'}
              </Button>
            </Popconfirm>
          )}
          <Button
            type="link"
            size="small"
            style={{ padding: 0 }}
            onClick={() => navigate(`/admin/courses/${r.id}/edit`)}
          >
            編輯
          </Button>
          <Button
            type="link"
            size="small"
            style={{ padding: 0 }}
            onClick={() => navigate(`/admin/courses/${r.id}/duplicate`)}
          >
            複製
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Breadcrumb items={[{ title: '課程管理' }, { title: '團體課程' }, { title: '課程列表' }]} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            團體課程管理列表
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13, paddingBottom: 2 }}>
            共 {total} 門課程，其中 {onCount} 門上架中、{draftCount} 門草稿
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<InboxOutlined />} onClick={() => navigate('/admin/courses/archived')}>
            封存課程
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/courses/new')}>
            新增課程
          </Button>
        </Space>
      </div>

      <Card size="small">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Input
            placeholder="搜尋課程名稱或編號"
            prefix={<SearchOutlined />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            value={coachFilter}
            onChange={setCoachFilter}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: '全部教練' },
              ...(coaches ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部狀態' },
              ...COURSE_STATUSES.map((s) => ({ value: s, label: s })),
            ]}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.65)' }}>開課期間</span>
            <DatePicker.RangePicker
              value={range}
              onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
              placeholder={['開課起日', '開課訖日']}
              style={{ width: 260 }}
            />
          </div>
          <Button type="text" onClick={resetFilters}>
            清除篩選
          </Button>
          <div style={{ flex: 1 }} />
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            篩選結果 {filtered.length} 筆
          </Typography.Text>
        </div>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={isLoading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1500 }}
        />
      </Card>
    </Space>
  );
}

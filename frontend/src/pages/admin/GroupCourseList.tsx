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
import { PlusOutlined, SearchOutlined, InboxOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Dayjs } from 'dayjs';
import {
  listActiveCourses,
  updateCourseStatus,
  COURSE_STATUSES,
  type Course,
  type CourseStatus,
} from '../../api/courses';
import { listCoaches } from '../../api/coaches';
import { sharedCourseColumns } from '../../components/courseColumns';
import { useBranches } from '../../lib/useBranches';
import { formatServerTime } from '../../lib/datetime';

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
  const branchList = useBranches();
  const [branchFilter, setBranchFilter] = useState<number | 'all'>('all');
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
      if (branchFilter !== 'all' && c.branch_id !== branchFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (from && to) {
        if (!c.start_date || !c.end_date) return false;
        if (c.end_date < from || c.start_date > to) return false;
      }
      return true;
    });
  }, [all, q, coachFilter, branchFilter, statusFilter, range]);

  const resetFilters = () => {
    setQ('');
    setCoachFilter('all');
    setBranchFilter('all');
    setStatusFilter('all');
    setRange(null);
  };

  const columns: ColumnsType<Course> = [
    ...sharedCourseColumns({ coachNameById, branchName: branchList.nameOf }),
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
          <span style={{ fontSize: 13 }}>{formatServerTime(r.updated_at)}</span>
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
            value={branchFilter}
            onChange={setBranchFilter}
            style={{ width: 140 }}
            aria-label="分店"
            options={[
              { value: 'all', label: '全部分店' },
              ...branchList.branches.map((b) => ({ value: b.id, label: b.name })),
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
            <Typography.Text type="secondary" style={{ fontSize: 14 }}>
              開課期間
            </Typography.Text>
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

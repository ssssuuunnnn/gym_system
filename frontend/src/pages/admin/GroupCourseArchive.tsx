import { useMemo, useState } from 'react';
import {
  Breadcrumb,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { RollbackOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { type Dayjs } from 'dayjs';
import { deleteCourse, listArchivedCourses, restoreCourse, type Course } from '../../api/courses';
import { listCoaches } from '../../api/coaches';
import { sharedCourseColumns } from '../../components/courseColumns';
import { useBranches } from '../../lib/useBranches';
import { formatServerTime } from '../../lib/datetime';

/**
 * 封存團體課程：對應 Claude Design「封存課程」設計稿（`GroupCourseArchive.dc.html`）。
 * 課程於「編輯團體課程」按「封存」後移入此頁，可還原（回列表並維持下架）或永久刪除。
 */
export default function GroupCourseArchive() {
  const branchList = useBranches();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses', 'archived'],
    queryFn: listArchivedCourses,
  });
  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const coachNameById = useMemo(
    () => new Map((coaches ?? []).map((c) => [c.id, c.name])),
    [coaches],
  );

  const [q, setQ] = useState('');
  const [coachFilter, setCoachFilter] = useState<number | 'all'>('all');
  const [archiverFilter, setArchiverFilter] = useState<string | 'all'>('all');
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);

  const all = useMemo(() => courses ?? [], [courses]);
  const archivers = useMemo(
    () => Array.from(new Set(all.map((c) => c.archived_by_name).filter(Boolean) as string[])),
    [all],
  );

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreCourse(id),
    onSuccess: (updated) => {
      message.success(`已還原「${updated.name}」，狀態為下架`);
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: () => message.error('還原失敗，請稍後再試'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCourse(id),
    onSuccess: () => {
      message.success('已永久刪除課程');
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (error) => {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      message.error(detail || '刪除失敗，請稍後再試');
    },
  });

  const confirmDelete = (course: Course) => {
    Modal.confirm({
      title: `永久刪除「${course.name}」？`,
      content: '此操作無法復原，將一併刪除排課規則與所有課堂。',
      okText: '永久刪除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => deleteMutation.mutateAsync(course.id),
    });
  };

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
      if (archiverFilter !== 'all' && c.archived_by_name !== archiverFilter) return false;
      if (from && to) {
        if (!c.start_date || !c.end_date) return false;
        if (c.end_date < from || c.start_date > to) return false;
      }
      return true;
    });
  }, [all, q, coachFilter, archiverFilter, range]);

  const resetFilters = () => {
    setQ('');
    setCoachFilter('all');
    setArchiverFilter('all');
    setRange(null);
  };

  const columns: ColumnsType<Course> = [
    ...sharedCourseColumns({ coachNameById, branchName: branchList.nameOf }),
    {
      title: '封存時間',
      dataIndex: 'archived_at',
      width: 150,
      render: (v: string | null) => formatServerTime(v),
    },
    {
      title: '封存者',
      dataIndex: 'archived_by_name',
      width: 100,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: '最後編輯時間',
      dataIndex: 'updated_at',
      width: 150,
      render: (v: string) => formatServerTime(v),
    },
    {
      title: '編輯者',
      dataIndex: 'updated_by_name',
      width: 100,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Popconfirm
            title={`還原「${r.name}」？`}
            description="還原後回到課程列表並維持下架狀態。"
            onConfirm={() => restoreMutation.mutate(r.id)}
          >
            <Button type="link" size="small" style={{ padding: 0 }}>
              還原
            </Button>
          </Popconfirm>
          <Button
            type="link"
            size="small"
            danger
            style={{ padding: 0 }}
            onClick={() => confirmDelete(r)}
          >
            永久刪除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Breadcrumb items={[{ title: '課程管理' }, { title: '團體課程' }, { title: '封存課程' }]} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            封存團體課程
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13, paddingBottom: 2 }}>
            共 {all.length} 門已封存課程，還原後回到課程列表並維持下架狀態
          </Typography.Text>
        </div>
        <Button icon={<RollbackOutlined />} onClick={() => navigate('/admin/courses')}>
          返回課程列表
        </Button>
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
            value={archiverFilter}
            onChange={setArchiverFilter}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: '全部封存者' },
              ...archivers.map((a) => ({ value: a, label: a })),
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
          pagination={{
            pageSize: 10,
            showTotal: (total, [a, b]) => `顯示 ${a}–${b} 筆，共 ${total} 筆`,
          }}
          scroll={{ x: 1600 }}
          locale={{
            emptyText: (
              <Empty description="目前沒有符合條件的封存課程" style={{ padding: '48px 0' }} />
            ),
          }}
        />
      </Card>
    </Space>
  );
}

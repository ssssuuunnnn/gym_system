import { useMemo, useState } from 'react';
import {
  Breadcrumb,
  Button,
  Card,
  DatePicker,
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
import { ArrowLeftOutlined, PictureOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import { deleteCourse, listArchivedCourses, restoreCourse, type Course } from '../../api/courses';
import { listCoaches } from '../../api/coaches';
import { weekdayLabel } from '../../lib/weekday';

/**
 * 封存團體課程：對應 Claude Design「封存課程」設計稿。
 * 課程於「編輯團體課程」按「封存」後移入此頁，可還原（回列表並維持下架）或永久刪除。
 */
export default function GroupCourseArchive() {
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
      width: 240,
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
      width: 200,
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
              : '—'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '封存時間',
      dataIndex: 'archived_at',
      width: 150,
      render: (v: string | null, r) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13 }}>{v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—'}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.archived_by_name ?? '—'}
          </Typography.Text>
        </div>
      ),
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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/courses')}>
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
          locale={{ emptyText: '目前沒有符合條件的封存課程' }}
        />
      </Card>
    </Space>
  );
}

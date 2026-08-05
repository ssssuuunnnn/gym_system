import { Card, Typography, Table, Button, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listCourses, type Course } from '../../api/courses';
import { listCoaches } from '../../api/coaches';

const WEEKDAY_LABEL = ['', '週一', '週二', '週三', '週四', '週五', '週六', '週日'];

/**
 * 課程管理列表：對應「課程管理列表」。後端目前僅提供 list/create/update，無刪除 API。
 */
export default function CourseList() {
  const navigate = useNavigate();

  const { data: courses, isLoading } = useQuery({ queryKey: ['courses'], queryFn: listCourses });
  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });

  const coachNameById = new Map((coaches ?? []).map((c) => [c.id, c.name]));

  const columns: ColumnsType<Course> = [
    { title: '課程名稱', dataIndex: 'name' },
    {
      title: '綁定教練',
      dataIndex: 'coach_id',
      render: (coachId: number) => coachNameById.get(coachId) ?? `#${coachId}`,
    },
    {
      title: '時段',
      key: 'time',
      render: (_, record) => `${WEEKDAY_LABEL[record.day_of_week] ?? record.day_of_week} ${record.start_hour}:00`,
    },
    { title: '人數上限', dataIndex: 'max_capacity' },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/admin/courses/${record.id}/edit`)}>
            編輯
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          課程管理列表
        </Typography.Title>
        <Button type="primary" onClick={() => navigate('/admin/courses/new')}>
          新增課程
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={courses}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
}

import { Card, Typography, Table, Button, Space, Popconfirm, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatServerTime } from '../../lib/datetime';
import { listCoaches, deleteCoach, type Coach } from '../../api/coaches';
import { listMembers } from '../../api/users';

/**
 * 教練資料列表：對應「教練管理」章節。教練資料以 user_id 綁定會員帳號，
 * 列表額外查詢會員清單以顯示綁定帳號的使用者名稱（後端 CoachOut 僅回傳 user_id）。
 */
export default function CoachList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: coaches, isLoading } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers });

  const usernameByUserId = new Map((members ?? []).map((m) => [m.id, m.username]));

  const deleteMutation = useMutation({
    mutationFn: deleteCoach,
    onSuccess: () => {
      message.success('已刪除教練資料');
      queryClient.invalidateQueries({ queryKey: ['coaches'] });
    },
    onError: () => {
      message.error('刪除失敗，請稍後再試');
    },
  });

  const columns: ColumnsType<Coach> = [
    { title: '姓名', dataIndex: 'name' },
    {
      title: '類型',
      dataIndex: 'coach_types',
      render: (types: Coach['coach_types']) => (
        <Space size={4} wrap>
          {types.map((t) => (
            <Tag key={t} color={t === '場租教練' ? 'default' : t === '團體課程教練' ? 'purple' : 'blue'}>
              {t}
            </Tag>
          ))}
        </Space>
      ),
    },
    { title: '電話', dataIndex: 'phone' },
    {
      title: '綁定帳號',
      dataIndex: 'user_id',
      render: (userId: number) => usernameByUserId.get(userId) ?? `#${userId}`,
    },
    {
      title: '建立時間',
      dataIndex: 'created_at',
      render: (value: string) => formatServerTime(value),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/admin/coaches/${record.id}/courses`)}>
            授課
          </Button>
          <Button size="small" onClick={() => navigate(`/admin/coaches/${record.id}/edit`)}>
            編輯
          </Button>
          <Popconfirm
            title="確定要刪除這筆教練資料？"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button size="small" danger loading={deleteMutation.isPending}>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          教練資料列表
        </Typography.Title>
        <Button type="primary" onClick={() => navigate('/admin/coaches/new')}>
          新增教練
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={coaches}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
}

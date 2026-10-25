import { Card, Typography, Table, Button, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatServerTime } from '../../lib/datetime';
import { listMembers, type Member } from '../../api/users';

/**
 * 會員列表：對應「會員列表」。身份（學員／教練）為衍生值，教練類型見教練資料，來自後端 UserOut.is_coach。
 */
export default function MemberList() {
  const navigate = useNavigate();

  const { data: members, isLoading } = useQuery({ queryKey: ['members'], queryFn: listMembers });

  const columns: ColumnsType<Member> = [
    { title: '帳號', dataIndex: 'username' },
    { title: '姓名', dataIndex: 'display_name', render: (v: string | null) => v ?? '—' },
    { title: '手機', dataIndex: 'phone', render: (v: string | null) => v ?? '—' },
    {
      title: 'LINE',
      dataIndex: 'line_linked',
      render: (linked: boolean) => (linked ? <Tag color="green">已綁定</Tag> : <Tag>未綁定</Tag>),
    },
    {
      title: '身份',
      dataIndex: 'is_coach',
      render: (isCoach: boolean) => <Tag color={isCoach ? 'blue' : 'default'}>{isCoach ? '教練' : '學員'}</Tag>,
    },
    {
      title: '加入時間',
      dataIndex: 'created_at',
      render: (value: string) => formatServerTime(value),
    },
    {
      title: '最後操作時間',
      dataIndex: 'last_login_at',
      render: (value: string | null) => formatServerTime(value),
    },
    {
      title: '黑名單',
      dataIndex: 'is_blacklisted',
      render: (isBlacklisted: boolean) =>
        isBlacklisted ? <Tag color="red">已列入黑名單</Tag> : <Tag>正常</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Button size="small" onClick={() => navigate(`/admin/members/${record.id}`)}>
          查看詳情
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        會員列表
      </Typography.Title>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={members}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
}

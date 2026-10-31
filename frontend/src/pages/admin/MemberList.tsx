import { useMemo, useState } from 'react';
import { Card, Typography, Table, Button, Tag, Input, Space, Segmented } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatServerTime } from '../../lib/datetime';
import { listMembers, type Member } from '../../api/users';
import { useTerms } from '../../lib/terms';
import { MemberTagSelect } from '../../components/MemberTagSelect';
import { MemberTagList } from '../../components/MemberTagList';

/** 多個標籤時：有其中任一個／全部都有 */
type TagMatch = '任一' | '全部';

/**
 * 會員列表：對應「會員列表」。身份（學員／教練）為衍生值，教練類型見教練資料，來自後端 UserOut.is_coach。
 * 可依關鍵字（帳號／姓名／手機）與會員標籤篩選（ADR 0012；?tag=<id> 從會員標籤頁帶過來）。
 */
export default function MemberList() {
  const navigate = useNavigate();
  const { t } = useTerms();

  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = useState('');
  const [tagIds, setTagIds] = useState<number[]>(() => {
    const id = Number(searchParams.get('tag'));
    return Number.isInteger(id) && id > 0 ? [id] : [];
  });
  const [tagMatch, setTagMatch] = useState<TagMatch>('任一');

  const { data: members, isLoading } = useQuery({ queryKey: ['members'], queryFn: listMembers });

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return (members ?? []).filter((m) => {
      if (k && ![m.username, m.display_name ?? '', m.phone ?? ''].some((v) => v.toLowerCase().includes(k))) return false;
      if (tagIds.length) {
        const own = new Set(m.tag_ids ?? []);
        return tagMatch === '全部' ? tagIds.every((id) => own.has(id)) : tagIds.some((id) => own.has(id));
      }
      return true;
    });
  }, [members, keyword, tagIds, tagMatch]);

  const columns: ColumnsType<Member> = [
    { title: '帳號', dataIndex: 'username' },
    { title: '姓名', dataIndex: 'display_name', render: (v: string | null) => v ?? '—' },
    { title: '手機', dataIndex: 'phone', render: (v: string | null) => v ?? '—' },
    {
      title: '標籤',
      dataIndex: 'tag_ids',
      render: (ids: number[] | undefined) => <MemberTagList ids={ids} />,
    },
    {
      title: 'LINE',
      dataIndex: 'line_linked',
      render: (linked: boolean) => (linked ? <Tag color="green">已綁定</Tag> : <Tag>未綁定</Tag>),
    },
    {
      title: '身份',
      dataIndex: 'is_coach',
      render: (isCoach: boolean) => <Tag color={isCoach ? 'blue' : 'default'}>{isCoach ? t.staff : t.customer}</Tag>,
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
      <Space wrap size={12} style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="搜尋帳號、姓名或手機"
          aria-label="搜尋會員"
          style={{ width: 240 }}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <MemberTagSelect value={tagIds} onChange={setTagIds} placeholder="依標籤篩選" style={{ width: 260 }} />
        {tagIds.length > 1 && (
          <Segmented<TagMatch> options={['任一', '全部']} value={tagMatch} onChange={setTagMatch} aria-label="標籤符合方式" />
        )}
        <Link to="/admin/member-tags">管理標籤</Link>
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        loading={isLoading}
        pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 位` }}
        scroll={{ x: 960 }}
      />
    </Card>
  );
}

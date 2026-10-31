import { useState } from 'react';
import { App, Button, Card, Flex, Popconfirm, Segmented, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { EditOutlined, ExportOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { deleteNews, listNews, type NewsPost } from '../../../api/news';
import { apiErrorMessage } from '../../../api/errors';
import { getWebsite } from '../../../api/website';
import { formatServerTime } from '../../../lib/datetime';
import { usePermissions } from '../../../lib/permissions';
import { NewsFormDrawer } from './components/NewsFormDrawer';
import { SendNewsModal } from './components/SendNewsModal';

type StatusFilter = '全部' | '已發布' | '草稿';

/**
 * 最新消息（ADR 0012）：店家自己發的公告。發布後出現在形象網站的「最新消息」，
 * 也可以用 LINE 發給有某些標籤、或符合會員名單條件的會員（需要「會員名單」權限）。
 */
export default function News() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canSend = can('segments');
  const canWebsite = can('website');
  const [editing, setEditing] = useState<NewsPost | 'new' | null>(null);
  const [sending, setSending] = useState<NewsPost | null>(null);
  const [status, setStatus] = useState<StatusFilter>('全部');

  const { data: posts = [], isLoading } = useQuery({ queryKey: ['news'], queryFn: listNews });
  const { data: website } = useQuery({ queryKey: ['website'], queryFn: getWebsite, enabled: canWebsite });

  const deleteMutation = useMutation({
    mutationFn: (p: NewsPost) => deleteNews(p.id),
    onSuccess: (_, p) => {
      message.success(`已刪除「${p.title}」`);
      queryClient.invalidateQueries({ queryKey: ['news'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const rows = status === '全部' ? posts : posts.filter((p) => p.is_published === (status === '已發布'));

  const columns: ColumnsType<NewsPost> = [
    {
      title: '消息',
      key: 'title',
      render: (_, p) => (
        <Flex gap={12} align="flex-start">
          {p.image_url && (
            <img src={p.image_url} alt="" width={72} height={47} style={{ objectFit: 'cover', borderRadius: 6, flex: 'none' }} />
          )}
          <Flex vertical style={{ minWidth: 0 }}>
            <Typography.Text strong>{p.title}</Typography.Text>
            {p.summary && (
              <Typography.Text type="secondary" ellipsis style={{ maxWidth: 420 }}>
                {p.summary}
              </Typography.Text>
            )}
          </Flex>
        </Flex>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'is_published',
      width: 90,
      render: (v: boolean) => (v ? <Tag color="green">已發布</Tag> : <Tag>草稿</Tag>),
    },
    {
      title: '發布日期',
      dataIndex: 'published_at',
      width: 120,
      render: (v: string | null, p) => (p.is_published ? formatServerTime(v, 'YYYY-MM-DD') : '—'),
    },
    {
      title: 'LINE 發送',
      key: 'broadcast',
      width: 150,
      render: (_, p) =>
        p.broadcast_count ? (
          <Flex vertical>
            <span>{p.broadcast_count} 次</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              最近 {formatServerTime(p.last_broadcast_at, 'MM-DD HH:mm')}
            </Typography.Text>
          </Flex>
        ) : (
          '—'
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      render: (_, p) => (
        <Space wrap>
          {canWebsite && (
            <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(p)}>
              編輯
            </Button>
          )}
          {canSend && (
            <Tooltip title={p.is_published ? undefined : '請先發布，會員點開才看得到內容'}>
              <Button size="small" icon={<SendOutlined />} disabled={!p.is_published} onClick={() => setSending(p)}>
                用 LINE 發送
              </Button>
            </Tooltip>
          )}
          {p.is_published && (
            <Button size="small" icon={<ExportOutlined />} href={p.path} target="_blank" rel="noopener">
              網站
            </Button>
          )}
          {canWebsite && (
            <Popconfirm
              title={`刪除「${p.title}」？`}
              description="網站上會移除；已經用 LINE 發出的訊息收不回來，點開會顯示找不到"
              okText="刪除"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={() => deleteMutation.mutate(p)}
            >
              <Button size="small" danger>
                刪除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            最新消息
          </Typography.Title>
          <Typography.Text type="secondary">
            發布後出現在形象網站的「最新消息」；也可以用 LINE 發給有某些標籤、或符合會員名單條件的會員
          </Typography.Text>
        </div>
        {canWebsite && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
            新增消息
          </Button>
        )}
      </div>

      {website && !website.is_published && (
        <Typography.Text type="warning">
          形象網站還沒發布，訪客與會員暫時看不到消息。請到 <Link to="/admin/website">形象網站</Link> 發布。
        </Typography.Text>
      )}

      <Card>
        <Flex vertical gap={16}>
          <Segmented<StatusFilter>
            value={status}
            onChange={setStatus}
            options={['全部', '已發布', '草稿']}
            style={{ alignSelf: 'flex-start' }}
          />
          <Table
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={isLoading}
            scroll={{ x: 900 }}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            locale={{ emptyText: '還沒有消息，點右上角「新增消息」開始' }}
          />
        </Flex>
      </Card>

      <NewsFormDrawer
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={(post, isNew) => {
          setEditing(null);
          if (isNew && post.is_published && canSend) {
            message.info('要通知會員的話，按這則消息的「用 LINE 發送」');
          }
        }}
      />
      <SendNewsModal post={sending} onClose={() => setSending(null)} />
    </Space>
  );
}

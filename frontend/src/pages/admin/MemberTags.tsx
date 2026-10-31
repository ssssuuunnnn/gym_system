import { useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Popconfirm, Radio, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  TAG_COLORS,
  createMemberTag,
  deleteMemberTag,
  updateMemberTag,
  type MemberTag,
  type MemberTagInput,
} from '../../api/memberTags';
import { apiErrorMessage } from '../../api/errors';
import { useMemberTags } from '../../lib/useMemberTags';
import { formatServerTime } from '../../lib/datetime';

type Editing = { mode: 'new' } | { mode: 'edit'; tag: MemberTag } | null;

/**
 * 會員標籤（ADR 0012）：店家自訂的分類，例如「VIP」「早鳥班」。
 * 在會員詳情幫會員貼標籤，或在會員名單把篩出來的人一次加上；會員列表、會員名單可依標籤篩選，
 * 最新消息可以用 LINE 發給有某些標籤的會員。標籤只有後台看得到。
 */
export default function MemberTags() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { tags, isLoading } = useMemberTags();
  const [editing, setEditing] = useState<Editing>(null);
  const [form] = Form.useForm<MemberTagInput>();
  const color = Form.useWatch('color', form);
  const name = Form.useWatch('name', form);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['member-tags'] });
    queryClient.invalidateQueries({ queryKey: ['members'] });
  };
  const saveMutation = useMutation({
    mutationFn: (values: MemberTagInput) =>
      editing?.mode === 'edit' ? updateMemberTag(editing.tag.id, values) : createMemberTag(values),
    onSuccess: () => {
      message.success(editing?.mode === 'edit' ? '已更新標籤' : '已新增標籤');
      setEditing(null);
      refresh();
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });
  const deleteMutation = useMutation({
    mutationFn: (tag: MemberTag) => deleteMemberTag(tag.id),
    onSuccess: (_, tag) => {
      message.success(`已刪除「${tag.name}」`);
      refresh();
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const open = (next: Editing) => {
    setEditing(next);
    form.setFieldsValue(next?.mode === 'edit' ? { name: next.tag.name, color: next.tag.color } : { name: '', color: 'blue' });
  };

  const columns: ColumnsType<MemberTag> = [
    { title: '標籤', dataIndex: 'name', render: (n: string, t) => <Tag color={t.color}>{n}</Tag> },
    {
      title: '會員人數',
      dataIndex: 'member_count',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.member_count - b.member_count,
      render: (n: number, t) => <Link to={`/admin/members?tag=${t.id}`}>{n} 人</Link>,
    },
    {
      title: 'LINE 收得到',
      dataIndex: 'sendable_count',
      width: 130,
      align: 'right',
      render: (n: number) => `${n} 人`,
    },
    { title: '建立時間', dataIndex: 'created_at', width: 160, render: (v: string) => formatServerTime(v, 'YYYY-MM-DD') },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, t) => (
        <Space>
          <Button size="small" onClick={() => open({ mode: 'edit', tag: t })}>
            編輯
          </Button>
          <Popconfirm
            title={`刪除「${t.name}」？`}
            description={t.member_count ? `${t.member_count} 位會員身上的這個標籤會一起拿掉（會員資料不受影響）` : undefined}
            okText="刪除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => deleteMutation.mutate(t)}
          >
            <Button size="small" danger>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            會員標籤
          </Typography.Title>
          <Typography.Text type="secondary">
            自訂會員分類；在會員詳情貼標籤，會員列表、會員名單可依標籤篩選，最新消息可發給某些標籤的會員。會員看不到標籤。
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open({ mode: 'new' })}>
          新增標籤
        </Button>
      </div>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tags}
          loading={isLoading}
          pagination={false}
          scroll={{ x: 640 }}
          locale={{ emptyText: '還沒有標籤，點右上角「新增標籤」開始' }}
        />
      </Card>

      <Modal
        open={editing !== null}
        title={editing?.mode === 'edit' ? '編輯標籤' : '新增標籤'}
        okText="儲存"
        cancelText="取消"
        confirmLoading={saveMutation.isPending}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form<MemberTagInput> form={form} layout="vertical" requiredMark={false} onFinish={(v) => saveMutation.mutate(v)}>
          <Form.Item label="標籤名稱" name="name" rules={[{ required: true, whitespace: true, message: '請輸入標籤名稱' }]}>
            <Input maxLength={20} showCount placeholder="例如：VIP、早鳥班" />
          </Form.Item>
          <Form.Item label="顏色" name="color">
            <Radio.Group>
              <Space size={[4, 8]} wrap>
                {TAG_COLORS.map((c) => (
                  <Radio.Button key={c.value} value={c.value} aria-label={c.label}>
                    <Tag color={c.value} style={{ margin: 0 }}>
                      {c.label}
                    </Tag>
                  </Radio.Button>
                ))}
              </Space>
            </Radio.Group>
          </Form.Item>
          <Typography.Text type="secondary">
            預覽：<Tag color={color}>{name?.trim() || '標籤名稱'}</Tag>
          </Typography.Text>
        </Form>
      </Modal>
    </Space>
  );
}

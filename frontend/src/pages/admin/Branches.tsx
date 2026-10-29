import { useState } from 'react';
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBranch, updateBranch, type Branch, type BranchPayload } from '../../api/branches';
import { apiErrorMessage } from '../../api/errors';
import { useBranches } from '../../lib/useBranches';

type Editing = { mode: 'new' } | { mode: 'edit'; branch: Branch } | null;

/**
 * 分店管理（ADR 0007）：同一家公司底下的營業地點，網址與帳號共用。
 * 分店不能刪除（課程、預約都記錄了分店），只能停用；停用前要先把該店的上架課程下架。
 */
export default function Branches() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { branches, isLoading } = useBranches();
  const [editing, setEditing] = useState<Editing>(null);
  const [form] = Form.useForm<BranchPayload>();

  const done = (text: string) => {
    message.success(text);
    queryClient.invalidateQueries({ queryKey: ['branches'] });
  };
  const saveMutation = useMutation({
    mutationFn: (values: BranchPayload) =>
      editing?.mode === 'edit' ? updateBranch(editing.branch.id, values) : createBranch(values),
    onSuccess: () => {
      done(editing?.mode === 'edit' ? '已更新分店' : '已新增分店');
      setEditing(null);
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });
  const toggleMutation = useMutation({
    mutationFn: (b: Branch) => updateBranch(b.id, { is_active: !b.is_active }),
    onSuccess: (b) => done(b.is_active ? `已啟用「${b.name}」` : `已停用「${b.name}」`),
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const open = (next: Editing) => {
    setEditing(next);
    form.setFieldsValue(
      next?.mode === 'edit'
        ? { name: next.branch.name, address: next.branch.address, phone: next.branch.phone, sort_order: next.branch.sort_order }
        : { name: '', address: '', phone: '', sort_order: branches.length },
    );
  };

  const columns: ColumnsType<Branch> = [
    {
      title: '分店名稱',
      dataIndex: 'name',
      render: (name: string, b) => (
        <Space>
          {name}
          {!b.is_active && <Tag>已停用</Tag>}
        </Space>
      ),
    },
    { title: '地址', dataIndex: 'address', render: (v: string | null) => v ?? '—' },
    { title: '電話', dataIndex: 'phone', render: (v: string | null) => v ?? '—' },
    { title: '排序', dataIndex: 'sort_order', align: 'right', width: 80 },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, b) => (
        <Space>
          <Button size="small" onClick={() => open({ mode: 'edit', branch: b })}>
            編輯
          </Button>
          <Popconfirm
            title={b.is_active ? `停用「${b.name}」？` : `啟用「${b.name}」？`}
            description={b.is_active ? '停用後不能再新增這間的課程與預約，既有資料保留。' : undefined}
            okText={b.is_active ? '停用' : '啟用'}
            cancelText="取消"
            okButtonProps={{ danger: b.is_active }}
            onConfirm={() => toggleMutation.mutateAsync(b)}
          >
            <Button size="small" danger={b.is_active}>
              {b.is_active ? '停用' : '啟用'}
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
            分店管理
          </Typography.Title>
          <Typography.Text type="secondary">
            課程、公休與預約都屬於某一間分店；教練可在多間分店授課，方案預設全分店通用
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open({ mode: 'new' })}>
          新增分店
        </Button>
      </div>

      <Card>
        <Table rowKey="id" columns={columns} dataSource={branches} loading={isLoading} pagination={false} scroll={{ x: 640 }} />
      </Card>

      <Modal
        open={editing !== null}
        title={editing?.mode === 'edit' ? '編輯分店' : '新增分店'}
        okText="儲存"
        cancelText="取消"
        confirmLoading={saveMutation.isPending}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form<BranchPayload> form={form} layout="vertical" requiredMark={false} onFinish={(v) => saveMutation.mutate(v)}>
          <Form.Item label="分店名稱" name="name" rules={[{ required: true, whitespace: true, message: '請輸入分店名稱' }]}>
            <Input maxLength={50} placeholder="例如：信義店" />
          </Form.Item>
          <Form.Item label="地址" name="address">
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item label="電話" name="phone">
            <Input maxLength={30} inputMode="tel" />
          </Form.Item>
          <Form.Item label="排序" name="sort_order" extra="數字小的排前面；排第一的啟用分店是新增資料時的預設分店">
            <InputNumber min={0} max={999} precision={0} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

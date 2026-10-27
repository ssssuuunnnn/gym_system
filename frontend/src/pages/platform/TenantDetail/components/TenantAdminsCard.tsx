import { useState } from 'react';
import { App, Button, Card, Checkbox, Form, Input, Modal, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTenantAdmin,
  listTenantAdmins,
  resetTenantAdminPassword,
  type Tenant,
  type TenantAdmin,
} from '../../../../api/platform';
import { apiErrorMessage } from '../../../../api/platformClient';
import { showCredentials } from '../../../../components/credentials';
import { tenantUrl } from '../../../../lib/host';
import { formatServerTime } from '../../../../lib/datetime';
import { generatePassword, MIN_PASSWORD_LENGTH } from '../../../../lib/password';

interface AdminFormValues {
  username: string;
  password: string;
  must_change_password: boolean;
}

/** 開「新增管理員」或「重設密碼」對話框：reset 有值時是重設該帳號 */
type DialogState = { kind: 'create' } | { kind: 'reset'; admin: TenantAdmin } | null;

export interface TenantAdminsCardProps {
  tenant: Tenant;
}

/**
 * 這家健身房的管理員帳號：平台只管理員層級（新增、協助重設密碼），不碰會員與教練帳號。
 * 密碼送出後只在成功對話框顯示一次。
 */
export function TenantAdminsCard({ tenant }: TenantAdminsCardProps) {
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [form] = Form.useForm<AdminFormValues>();

  const { data: admins, isLoading } = useQuery({
    queryKey: ['platform-tenant-admins', tenant.id],
    queryFn: () => listTenantAdmins(tenant.id),
  });

  const mutation = useMutation({
    mutationFn: async (values: AdminFormValues) => {
      if (dialog?.kind === 'reset') {
        return resetTenantAdminPassword(tenant.id, dialog.admin.id, {
          new_password: values.password,
          must_change_password: values.must_change_password,
        });
      }
      return createTenantAdmin(tenant.id, values);
    },
    onSuccess: (admin, values) => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-admins', tenant.id] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant', tenant.id] });
      queryClient.invalidateQueries({ queryKey: ['platform-audit-logs'] });
      showCredentials(modal, {
        title: dialog?.kind === 'reset' ? `已重設「${admin.username}」的密碼` : `已新增管理員「${admin.username}」`,
        credentials: {
          loginUrl: `${tenantUrl(tenant.subdomain)}/login`,
          username: admin.username,
          password: values.password,
          mustChangePassword: values.must_change_password,
        },
      });
      setDialog(null);
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const open = (next: Exclude<DialogState, null>) => {
    form.setFieldsValue({
      username: next.kind === 'reset' ? next.admin.username : '',
      password: generatePassword(),
      must_change_password: true,
    });
    setDialog(next);
  };

  const columns: ColumnsType<TenantAdmin> = [
    {
      title: '帳號',
      dataIndex: 'username',
      render: (v: string, a) => (
        <Space size={4}>
          {v}
          {a.must_change_password && <Tag color="gold">待修改密碼</Tag>}
          {a.is_blacklisted && <Tag color="red">已停權</Tag>}
        </Space>
      ),
    },
    {
      title: '最後登入',
      dataIndex: 'last_login_at',
      width: 170,
      render: (v: string | null) => (v ? formatServerTime(v) : <Typography.Text type="secondary">從未登入</Typography.Text>),
    },
    { title: '建立時間', dataIndex: 'created_at', width: 170, render: (v: string) => formatServerTime(v) },
    {
      title: '',
      key: 'actions',
      width: 110,
      align: 'right',
      render: (_, a) => (
        <Button size="small" onClick={() => open({ kind: 'reset', admin: a })}>
          重設密碼
        </Button>
      ),
    },
  ];

  return (
    <Card
      title="管理員帳號"
      extra={
        <Button icon={<PlusOutlined />} onClick={() => open({ kind: 'create' })}>
          新增管理員
        </Button>
      }
    >
      <Table rowKey="id" size="middle" columns={columns} dataSource={admins} loading={isLoading} pagination={false} />
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
        平台只管理各家的管理員帳號；會員與教練帳號由健身房自己的管理員在後台處理。
      </Typography.Paragraph>

      <Modal
        open={dialog !== null}
        title={dialog?.kind === 'reset' ? `重設「${dialog.admin.username}」的密碼` : '新增管理員'}
        okText={dialog?.kind === 'reset' ? '重設密碼' : '新增'}
        cancelText="取消"
        confirmLoading={mutation.isPending}
        onCancel={() => setDialog(null)}
        onOk={async () => mutation.mutate(await form.validateFields())}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="username" label="帳號" rules={[{ required: true, whitespace: true, message: '請輸入帳號' }]}>
            <Input maxLength={100} disabled={dialog?.kind === 'reset'} autoComplete="off" />
          </Form.Item>
          <Form.Item label={dialog?.kind === 'reset' ? '新密碼' : '密碼'} required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="password"
                noStyle
                rules={[
                  { required: true, message: '請輸入密碼' },
                  { min: MIN_PASSWORD_LENGTH, message: `密碼至少 ${MIN_PASSWORD_LENGTH} 個字元` },
                ]}
              >
                <Input autoComplete="new-password" />
              </Form.Item>
              <Button onClick={() => form.setFieldValue('password', generatePassword())}>重新產生</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="must_change_password" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>下次登入時必須自行修改密碼（建議）</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

import { useState } from 'react';
import { App, Button, Card, Flex, Popconfirm, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { PlusOutlined, SwapOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../../../api/errors';
import {
  createStaff,
  getStaffMeta,
  listStaff,
  listStaffLogs,
  resetStaffPassword,
  setStaffActive,
  transferOwner,
  updateStaff,
  type StaffAccount,
  type StaffAuditLog,
  type StaffLevel,
} from '../../../api/staff';
import { showCredentials } from '../../../components/credentials';
import { formatServerTime } from '../../../lib/datetime';
import { generatePassword } from '../../../lib/password';
import { StaffFormModal, type StaffFormValues } from './components/StaffFormModal';
import { TransferOwnerModal } from './components/TransferOwnerModal';

const LEVEL_COLOR: Record<StaffLevel, string> = { 主要管理者: 'gold', 管理者: 'blue', 一般使用者: 'default' };

type Editing = { mode: 'new' } | { mode: 'edit'; staff: StaffAccount } | null;

/**
 * 後台帳號（ADR 0008）：只有主要管理者看得到。新增帳號、設定一般使用者的功能、升級為管理者、
 * 停用、重設密碼、移交主要管理者；所有變更都留在下方的操作紀錄。
 */
export default function StaffAccounts() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Editing>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const { data: meta } = useQuery({ queryKey: ['staff-meta'], queryFn: getStaffMeta });
  const { data: staff = [], isLoading } = useQuery({ queryKey: ['staff'], queryFn: listStaff });
  const { data: logs = [] } = useQuery({ queryKey: ['staff-logs'], queryFn: () => listStaffLogs() });
  const labelOf = new Map((meta?.permissions ?? []).map((p) => [p.code, p.label]));
  const loginUrl = `${window.location.origin}/login`;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    queryClient.invalidateQueries({ queryKey: ['staff-logs'] });
  };
  const onError = (err: unknown) => message.error(apiErrorMessage(err));

  const saveMutation = useMutation({
    mutationFn: (v: StaffFormValues) =>
      editing?.mode === 'edit'
        ? updateStaff(editing.staff.id, {
            display_name: v.display_name || null,
            level: v.level,
            ...(v.level === '一般使用者' ? { permissions: v.permissions } : {}),
          })
        : createStaff({ username: v.username, display_name: v.display_name || null, password: v.password, level: v.level, permissions: v.permissions }),
    onSuccess: (saved, v) => {
      if (editing?.mode === 'new') {
        showCredentials(modal, {
          title: `已建立「${saved.display_name || saved.username}」`,
          credentials: { loginUrl, username: saved.username, password: v.password, mustChangePassword: true },
        });
      } else {
        message.success('已儲存');
      }
      setEditing(null);
      refresh();
    },
    onError,
  });
  const activeMutation = useMutation({
    mutationFn: (s: StaffAccount) => setStaffActive(s.id, !s.is_active),
    onSuccess: (s) => {
      message.success(s.is_active ? '已啟用' : '已停用，對方會立刻被登出');
      refresh();
    },
    onError,
  });
  const resetMutation = useMutation({
    mutationFn: ({ s, password }: { s: StaffAccount; password: string }) => resetStaffPassword(s.id, password),
    onSuccess: (s, { password }) => {
      showCredentials(modal, {
        title: `已重設「${s.display_name || s.username}」的密碼`,
        credentials: { loginUrl, username: s.username, password, mustChangePassword: true },
      });
      refresh();
    },
    onError,
  });
  const transferMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) => transferOwner(userId, password),
    onSuccess: (s) => {
      message.success(`已移交給「${s.display_name || s.username}」`);
      setTransferOpen(false);
      // 自己已不是主要管理者：重新讀取權限，這一頁會變成沒有權限
      queryClient.invalidateQueries({ queryKey: ['me'] });
      refresh();
    },
    onError,
  });

  const columns: ColumnsType<StaffAccount> = [
    {
      title: '帳號',
      key: 'name',
      render: (_, s) => (
        <Flex vertical>
          <span>{s.display_name || s.username}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {s.username}
          </Typography.Text>
        </Flex>
      ),
    },
    { title: '身分', dataIndex: 'level', render: (l: StaffLevel) => <Tag color={LEVEL_COLOR[l]}>{l}</Tag> },
    {
      title: '可以使用的功能',
      key: 'perms',
      render: (_, s) => {
        if (s.level !== '一般使用者') return <Typography.Text type="secondary">全部功能</Typography.Text>;
        if (!s.permissions.length) return <Typography.Text type="warning">沒有任何功能</Typography.Text>;
        const names = s.permissions.map((c) => labelOf.get(c) ?? c);
        return (
          <Tooltip title={names.join('、')}>
            <span>{names.length > 3 ? `${names.slice(0, 3).join('、')} 等 ${names.length} 項` : names.join('、')}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '狀態',
      key: 'status',
      render: (_, s) => (
        <Space size={4} wrap>
          {s.is_active ? <Tag color="success">啟用</Tag> : <Tag>已停用</Tag>}
          {s.must_change_password && <Tag color="processing">待改密碼</Tag>}
        </Space>
      ),
    },
    { title: '最後登入', dataIndex: 'last_login_at', render: (v: string | null) => (v ? formatServerTime(v) : '—') },
    {
      title: '操作',
      key: 'actions',
      render: (_, s) =>
        s.level === '主要管理者' ? (
          <Button size="small" onClick={() => setEditing({ mode: 'edit', staff: s })}>
            編輯名稱
          </Button>
        ) : (
          <Space wrap>
            <Button size="small" onClick={() => setEditing({ mode: 'edit', staff: s })}>
              編輯權限
            </Button>
            <Popconfirm
              title={`重設「${s.display_name || s.username}」的密碼？`}
              description="會產生新密碼，對方下次登入要自己修改。"
              okText="重設"
              cancelText="取消"
              onConfirm={() => resetMutation.mutateAsync({ s, password: generatePassword() })}
            >
              <Button size="small">重設密碼</Button>
            </Popconfirm>
            <Popconfirm
              title={s.is_active ? `停用「${s.display_name || s.username}」？` : `啟用「${s.display_name || s.username}」？`}
              description={s.is_active ? '停用後不能登入，已登入的也會立刻失效；操作紀錄會保留。' : undefined}
              okText={s.is_active ? '停用' : '啟用'}
              okButtonProps={{ danger: s.is_active }}
              cancelText="取消"
              onConfirm={() => activeMutation.mutateAsync(s)}
            >
              <Button size="small" danger={s.is_active}>
                {s.is_active ? '停用' : '啟用'}
              </Button>
            </Popconfirm>
          </Space>
        ),
    },
  ];

  const logColumns: ColumnsType<StaffAuditLog> = [
    { title: '時間', dataIndex: 'created_at', width: 160, render: (v: string) => formatServerTime(v) },
    { title: '操作者', dataIndex: 'actor_name', width: 120 },
    { title: '動作', dataIndex: 'action', width: 120 },
    { title: '對象', dataIndex: 'target_name', width: 120, render: (v: string | null) => v ?? '—' },
    { title: '內容', dataIndex: 'detail', render: (v: string) => v || '—' },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-end" wrap gap={12}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            後台帳號
          </Typography.Title>
          <Typography.Text type="secondary">
            主要管理者可以新增帳號、設定一般使用者能用的功能、把帳號升級為管理者；管理者有全部功能但不能管理帳號
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<SwapOutlined />} onClick={() => setTransferOpen(true)}>
            移交主要管理者
          </Button>
          <Button type="primary" icon={<PlusOutlined />} disabled={!meta} onClick={() => setEditing({ mode: 'new' })}>
            新增帳號
          </Button>
        </Space>
      </Flex>

      <Card>
        <Table rowKey="id" columns={columns} dataSource={staff} loading={isLoading} pagination={false} scroll={{ x: 760 }} />
      </Card>

      <Card title="操作紀錄">
        <Table
          rowKey="id"
          size="small"
          columns={logColumns}
          dataSource={logs}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          scroll={{ x: 640 }}
        />
      </Card>

      {meta && (
        <StaffFormModal
          open={editing !== null}
          editing={editing?.mode === 'edit' ? editing.staff : null}
          meta={meta}
          saving={saveMutation.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={(v) => saveMutation.mutate(v)}
        />
      )}
      <TransferOwnerModal
        open={transferOpen}
        candidates={staff.filter((s) => s.level !== '主要管理者' && s.is_active)}
        saving={transferMutation.isPending}
        onCancel={() => setTransferOpen(false)}
        onSubmit={(userId, password) => transferMutation.mutate({ userId, password })}
      />
    </Flex>
  );
}

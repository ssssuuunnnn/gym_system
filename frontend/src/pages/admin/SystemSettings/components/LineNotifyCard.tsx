import { useState } from 'react';
import { Alert, App, Avatar, Button, Card, Checkbox, Empty, Popconfirm, Progress, Space, Statistic, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BellOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getLineSettings,
  LINE_EVENTS,
  removeLineRecipient,
  sendLineTest,
  updateLineRecipient,
  type LineNotifyFlag,
  type LineRecipient,
  type LineSettings,
} from '../../../../api/line';
import { apiErrorMessage } from '../../../../api/errors';
import { formatServerTime } from '../../../../lib/datetime';
import { LineBindModal } from './LineBindModal';

const QUERY_KEY = ['line-settings'];

/**
 * 系統設定 › LINE 通知（docs/adr/0004-line-notifications.md）：本月用量、接收人列表（各自勾選要收的通知）、
 * 新增接收人（綁定碼）、傳送測試通知、移除。所有操作立即生效。
 */
export function LineNotifyCard() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [bindOpen, setBindOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: getLineSettings });

  const toggleMutation = useMutation({
    mutationFn: ({ id, flag, value }: { id: number; flag: LineNotifyFlag; value: boolean }) =>
      updateLineRecipient(id, { [flag]: value }),
    // 先更新畫面，失敗再還原
    onMutate: async ({ id, flag, value }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<LineSettings>(QUERY_KEY);
      queryClient.setQueryData<LineSettings>(QUERY_KEY, (old) =>
        old ? { ...old, recipients: old.recipients.map((r) => (r.id === id ? { ...r, [flag]: value } : r)) } : old,
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
      message.error(apiErrorMessage(err));
    },
  });
  const testMutation = useMutation({
    mutationFn: (r: LineRecipient) => sendLineTest(r.id),
    onSuccess: (res, r) =>
      res.queued ? message.success(`已傳送測試通知給「${r.display_name}」，請查看 LINE`) : message.warning('沒有可傳送的對象'),
    onError: (err) => message.error(apiErrorMessage(err)),
  });
  const removeMutation = useMutation({
    mutationFn: (r: LineRecipient) => removeLineRecipient(r.id),
    onSuccess: (_res, r) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      message.success(`已停止通知「${r.display_name}」`);
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const columns: ColumnsType<LineRecipient> = [
    {
      title: '接收人',
      key: 'name',
      render: (_, r) => (
        <Space>
          <Avatar style={{ flex: 'none' }}>{r.display_name.charAt(0)}</Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{r.display_name}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {formatServerTime(r.created_at, 'MM/DD')} 綁定{r.bound_by_name ? `・${r.bound_by_name}` : ''}
            </Typography.Text>
          </div>
        </Space>
      ),
    },
    ...LINE_EVENTS.map(({ flag, label }) => ({
      title: label,
      key: flag,
      align: 'center' as const,
      width: 140,
      render: (_: unknown, r: LineRecipient) => (
        <Checkbox
          checked={r[flag]}
          aria-label={`${r.display_name}：${label}`}
          onChange={(e) => toggleMutation.mutate({ id: r.id, flag, value: e.target.checked })}
        />
      ),
    })),
    {
      title: '操作',
      key: 'actions',
      align: 'right',
      width: 200,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" onClick={() => testMutation.mutate(r)} loading={testMutation.isPending && testMutation.variables?.id === r.id}>
            傳送測試通知
          </Button>
          <Popconfirm
            title={`停止通知「${r.display_name}」？`}
            description="之後可以用新的綁定碼重新加入。"
            okText="移除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => removeMutation.mutateAsync(r)}
          >
            <Button size="small" type="text" danger>
              移除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const sent = data?.month_sent ?? 0;
  const cap = data?.monthly_cap ?? 0;
  const percent = cap > 0 ? Math.min(100, Math.round((sent / cap) * 100)) : 100;

  return (
    <Card
      title="LINE 通知"
      loading={isLoading}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setBindOpen(true)} disabled={!data?.configured}>
          新增接收人
        </Button>
      }
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          有新的體驗課詢問、會員下單待收款、預約待審核時，用 LINE 通知老闆和員工。
        </Typography.Text>
        {data && !data.configured && (
          <Alert type="warning" showIcon title="平台尚未設定 LINE 通知帳號，目前不會發送通知。" />
        )}

        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ minWidth: 220 }}>
            <Statistic title="本月已發送" value={sent} suffix={`/ ${cap} 則`} />
            <Progress
              percent={percent}
              showInfo={false}
              size="small"
              status={percent >= 100 ? 'exception' : 'normal'}
              aria-label="本月通知用量"
            />
          </div>
          <Statistic title="接收人" value={data?.recipients.length ?? 0} suffix="人" />
          <Typography.Paragraph type="secondary" style={{ flex: '1 1 280px', margin: 0 }}>
            一則通知發給幾個人就算幾則。達到每月上限後會暫停發送（後台的數字照常更新），每月 1 日重新計算。
          </Typography.Paragraph>
        </div>

        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={data?.recipients}
          pagination={false}
          scroll={{ x: 760 }}
          locale={{
            emptyText: (
              <Empty
                image={<BellOutlined style={{ fontSize: 40 }} />}
                styles={{ image: { height: 48 } }}
                description="還沒有人接收 LINE 通知。按「新增接收人」，用手機掃描 QR 碼並傳送綁定碼即可。"
              />
            ),
          }}
        />

        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          通知只寫姓氏、想體驗的課程與時段，<strong>不含手機號碼</strong>；點通知裡的連結登入後台查看完整資料。對方封鎖通知帳號時會自動停止通知。
        </Typography.Text>
      </Space>

      <LineBindModal
        open={bindOpen}
        botName={data?.bot_name ?? 'LINE 通知帳號'}
        onClose={() => setBindOpen(false)}
        onBound={(recipient) => {
          setBindOpen(false);
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
          if (recipient) message.success(`已綁定「${recipient.display_name}」`);
        }}
      />
    </Card>
  );
}

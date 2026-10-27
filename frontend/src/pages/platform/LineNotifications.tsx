import { useState } from 'react';
import { Alert, App, Card, DatePicker, InputNumber, Progress, Segmented, Space, Statistic, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { getLineUsage, listLineLogs, updateTenant, type LineGymUsage, type LineLog, type LineLogStatus } from '../../api/platform';
import { apiErrorMessage } from '../../api/errors';
import { formatServerTime } from '../../lib/datetime';
import StatusTag from '../../components/StatusTag';

type LogFilter = '全部' | Extract<LineLogStatus, '失敗' | '重試中' | '超過上限'>;
const LOG_FILTERS: LogFilter[] = ['全部', '失敗', '重試中', '超過上限'];

/** 每月上限：離開欄位或按 Enter 才儲存（寫入操作紀錄） */
function CapInput({ gym, onSave, saving }: { gym: LineGymUsage; onSave: (cap: number) => void; saving: boolean }) {
  const [value, setValue] = useState<number | null>(gym.cap);
  const commit = () => {
    if (value === null || value === gym.cap) {
      setValue(gym.cap);
      return;
    }
    onSave(value);
  };
  return (
    <InputNumber
      size="small"
      min={0}
      max={100000}
      step={100}
      value={value}
      disabled={saving}
      onChange={setValue}
      onBlur={commit}
      onPressEnter={commit}
      suffix="則"
      style={{ width: 120 }}
      aria-label={`${gym.name} 每月上限`}
    />
  );
}

/**
 * 平台 › LINE 通知：本月全平台用量（對照 LINE 方案額度）、各健身房用量與每月上限、發送紀錄。
 * 只有彙總數字與發送結果，看不到收件人與訊息內容。
 */
export default function LineNotifications() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [month, setMonth] = useState<Dayjs>(() => dayjs());
  const [filter, setFilter] = useState<LogFilter>('全部');
  const monthKey = month.format('YYYY-MM');

  const { data: usage, isLoading } = useQuery({
    queryKey: ['platform-line-usage', monthKey],
    queryFn: () => getLineUsage(monthKey),
  });
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['platform-line-logs', filter],
    queryFn: () => listLineLogs({ status: filter === '全部' ? undefined : filter, limit: 200 }),
  });

  const capMutation = useMutation({
    mutationFn: ({ gym, cap }: { gym: LineGymUsage; cap: number }) => updateTenant(gym.tenant_id, { line_monthly_cap: cap }),
    onSuccess: (_res, { gym, cap }) => {
      message.success(`「${gym.name}」每月上限改為 ${cap.toLocaleString()} 則`);
      queryClient.invalidateQueries({ queryKey: ['platform-line-usage'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const quota = usage?.plan_quota ?? 0;
  const sent = usage?.sent ?? 0;
  const quotaPercent = quota > 0 ? Math.min(100, Math.round((sent / quota) * 100)) : 0;
  const totalCap = usage?.gyms.reduce((sum, g) => sum + (g.recipients > 0 ? g.cap : 0), 0) ?? 0;

  const gymColumns: ColumnsType<LineGymUsage> = [
    {
      title: '健身房',
      key: 'name',
      render: (_, g) => (
        <div>
          <div style={{ fontWeight: 500 }}>{g.name}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {g.subdomain}
          </Typography.Text>
        </div>
      ),
    },
    { title: '接收人', dataIndex: 'recipients', align: 'right', width: 90 },
    {
      title: '本月已發送',
      key: 'sent',
      width: 220,
      render: (_, g) => {
        const pct = g.cap > 0 ? Math.min(100, Math.round((g.sent / g.cap) * 100)) : g.sent > 0 ? 100 : 0;
        return (
          <div>
            <Typography.Text style={{ fontVariantNumeric: 'tabular-nums' }}>
              {g.sent.toLocaleString()} / {g.cap.toLocaleString()}
            </Typography.Text>
            <Progress percent={pct} showInfo={false} size="small" status={pct >= 100 ? 'exception' : 'normal'} />
          </div>
        );
      },
    },
    {
      title: '每月上限',
      key: 'cap',
      width: 150,
      render: (_, g) => (
        <CapInput
          key={`${g.tenant_id}-${g.cap}`}
          gym={g}
          saving={capMutation.isPending && capMutation.variables?.gym.tenant_id === g.tenant_id}
          onSave={(cap) => capMutation.mutate({ gym: g, cap })}
        />
      ),
    },
    { title: '失敗', dataIndex: 'failed', align: 'right', width: 70 },
    { title: '超過上限', dataIndex: 'skipped', align: 'right', width: 90 },
    { title: '重試中', dataIndex: 'retrying', align: 'right', width: 80 },
  ];

  const logColumns: ColumnsType<LineLog> = [
    { title: '時間', dataIndex: 'created_at', width: 150, render: (v: string) => formatServerTime(v, 'MM/DD HH:mm') },
    { title: '健身房', dataIndex: 'tenant_name', width: 160, render: (v: string | null, r) => v ?? `#${r.tenant_id}` },
    { title: '事件', dataIndex: 'event', width: 160 },
    {
      title: '則數',
      key: 'count',
      align: 'right',
      width: 90,
      render: (_, r) => `${r.sent_count} / ${r.recipient_count}`,
    },
    { title: '結果', dataIndex: 'status', width: 110, render: (v: string) => <StatusTag status={v} /> },
    { title: '說明', dataIndex: 'note', render: (v: string | null) => v ?? '' },
  ];

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            LINE 通知
          </Typography.Title>
          <Typography.Text type="secondary">
            通知帳號「{usage?.bot_name ?? '—'}」的用量與發送紀錄；看不到收件人與訊息內容
          </Typography.Text>
        </div>
        <DatePicker
          picker="month"
          value={month}
          allowClear={false}
          onChange={(v) => v && setMonth(v)}
          disabledDate={(d) => d.isAfter(dayjs(), 'month')}
          aria-label="月份"
        />
      </div>

      {usage && !usage.configured && (
        <Alert
          type="warning"
          showIcon
          title="尚未設定 LINE 通知帳號"
          description="在伺服器環境變數設定 LINE_CHANNEL_SECRET、LINE_CHANNEL_ACCESS_TOKEN、LINE_BOT_BASIC_ID 後重新啟動，各健身房才能綁定與收到通知。"
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <Card loading={isLoading}>
          <Statistic title={`${monthKey} 全平台已發送`} value={sent} suffix={`/ ${quota.toLocaleString()} 則`} />
          <Progress percent={quotaPercent} showInfo={false} size="small" status={quotaPercent >= 90 ? 'exception' : 'normal'} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            LINE 方案每月額度，超過另計費
          </Typography.Text>
        </Card>
        <Card loading={isLoading}>
          <Statistic title="使用中的健身房" value={usage?.gyms_with_recipients ?? 0} suffix={`/ ${usage?.gyms.length ?? 0}`} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            上限合計 {totalCap.toLocaleString()} 則
          </Typography.Text>
        </Card>
        <Card loading={isLoading}>
          <Statistic title="接收人" value={usage?.recipients ?? 0} suffix="人" />
        </Card>
        <Card loading={isLoading}>
          <Statistic title="失敗／超過上限" value={`${usage?.failed ?? 0} / ${usage?.skipped ?? 0}`} suffix="則" />
        </Card>
      </div>

      <Card title="各健身房用量">
        <Table
          rowKey="tenant_id"
          size="middle"
          loading={isLoading}
          columns={gymColumns}
          dataSource={usage?.gyms}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          scroll={{ x: 820 }}
        />
      </Card>

      <Card
        title="發送紀錄"
        extra={<Segmented<LogFilter> options={LOG_FILTERS} value={filter} onChange={setFilter} />}
      >
        <Table
          rowKey="id"
          size="middle"
          loading={logsLoading}
          columns={logColumns}
          dataSource={logs}
          pagination={{ pageSize: 20, hideOnSinglePage: true, showTotal: (t) => `最近 ${t} 筆` }}
          scroll={{ x: 860 }}
        />
      </Card>
    </Space>
  );
}

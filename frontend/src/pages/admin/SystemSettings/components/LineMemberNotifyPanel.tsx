import { useState } from 'react';
import { App, Collapse, InputNumber, Progress, Select, Statistic, Switch, Table, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getLineOaQuota,
  listLineMemberMessages,
  MEMBER_NOTIFY_ITEMS,
  updateLineOaNotifications,
  type LineMemberMessage,
  type LineOaNotifyPayload,
  type LineOaSettings,
} from '../../../../api/lineOa';
import { apiErrorMessage } from '../../../../api/errors';
import { formatServerTime } from '../../../../lib/datetime';
import StatusTag from '../../../../components/StatusTag';

const { Text } = Typography;
const QUERY_KEY = ['line-oa'];
/** 上課提醒可選的整點（前一天） */
const REMINDER_HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

export interface LineMemberNotifyPanelProps {
  settings: LineOaSettings;
}

/**
 * LINE 官方帳號 › 會員通知（ADR 0005 第二階段）：逐項開關、上課提醒時間、每月上限、
 * 本月用量（系統發送數與 LINE 方案額度）、最近的通知紀錄。變更立即生效。
 */
export function LineMemberNotifyPanel({ settings }: LineMemberNotifyPanelProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);
  const [cap, setCap] = useState<number | null>(settings.member_monthly_cap);

  const { data: quota } = useQuery({
    queryKey: ['line-oa-quota'],
    queryFn: getLineOaQuota,
    enabled: settings.enabled,
    staleTime: 60_000,
  });
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['line-oa-messages'],
    queryFn: () => listLineMemberMessages(50),
    enabled: logOpen,
  });

  const mutation = useMutation({
    mutationFn: (payload: LineOaNotifyPayload) => updateLineOaNotifications(payload),
    onSuccess: (s) => {
      queryClient.setQueryData(QUERY_KEY, s);
      message.success('已更新會員通知設定');
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const saveCap = () => {
    if (cap === settings.member_monthly_cap) return;
    mutation.mutate({ member_monthly_cap: cap });
  };

  const quotaPercent =
    quota?.limited && quota.limit ? Math.min(100, Math.round(((quota.used ?? 0) / quota.limit) * 100)) : 0;

  const columns: ColumnsType<LineMemberMessage> = [
    { title: '時間', dataIndex: 'created_at', width: 130, render: (v: string) => formatServerTime(v, 'MM/DD HH:mm') },
    { title: '會員', dataIndex: 'member_name', width: 140 },
    { title: '通知', dataIndex: 'event', width: 120 },
    { title: '結果', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag status={v} /> },
    { title: '說明', dataIndex: 'note', render: (v: string | null) => v ?? '' },
  ];

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div>
        <Text strong style={{ fontSize: 15 }}>
          會員通知
        </Text>
        <div>
          <Text type="secondary" style={{ fontSize: 13 }}>
            從你的官方帳號推播給已綁定 LINE 的會員，訊息費用算在你的 LINE 方案；會員可在「我的」自行關閉。加好友與關鍵字的回覆不計費。
          </Text>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Statistic
          title="本月已推播給會員"
          value={settings.member_sent_this_month}
          suffix={settings.member_monthly_cap != null ? `/ ${settings.member_monthly_cap} 則` : '則'}
        />
        {settings.enabled && (
          <div style={{ minWidth: 220 }}>
            <Text type="secondary" style={{ fontSize: 14 }}>
              LINE 方案本月用量
            </Text>
            {quota?.error ? (
              <div>
                <Text type="warning" style={{ fontSize: 13 }}>
                  {quota.error}
                </Text>
              </div>
            ) : quota ? (
              <>
                <div style={{ fontSize: 24, lineHeight: 1.4 }}>
                  {(quota.used ?? 0).toLocaleString()}
                  <span style={{ fontSize: 14, marginLeft: 4 }}>
                    {quota.limited ? `/ ${quota.limit?.toLocaleString()} 則` : '則（不限量方案）'}
                  </span>
                </div>
                {quota.limited && (
                  <Progress
                    percent={quotaPercent}
                    showInfo={false}
                    size="small"
                    status={quotaPercent >= 90 ? 'exception' : 'normal'}
                    aria-label="LINE 方案本月用量"
                  />
                )}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  含官方帳號後台自己發的訊息
                </Text>
              </>
            ) : (
              <div style={{ fontSize: 13 }}>讀取中…</div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="member-cap" style={{ fontSize: 14, color: token.colorTextSecondary }}>
            每月上限
          </label>
          <InputNumber
            id="member-cap"
            min={0}
            step={50}
            precision={0}
            value={cap}
            placeholder="不限制"
            suffix="則"
            style={{ width: 160 }}
            onChange={setCap}
            onBlur={saveCap}
            onPressEnter={saveCap}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            留空＝不限制；達到上限後當月不再推播
          </Text>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {MEMBER_NOTIFY_ITEMS.map((item, i) => (
          <div
            key={item.flag}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 0',
              borderTop: i ? `1px solid ${token.colorBorderSecondary}` : 'none',
              flexWrap: 'wrap',
            }}
          >
            <Switch
              id={`member-notify-${item.flag}`}
              checked={settings[item.flag]}
              loading={mutation.isPending && mutation.variables?.[item.flag] !== undefined}
              onChange={(checked) => mutation.mutate({ [item.flag]: checked })}
            />
            <label htmlFor={`member-notify-${item.flag}`} style={{ flex: '1 1 260px', cursor: 'pointer' }}>
              <div>{item.label}</div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {item.hint}
              </Text>
            </label>
            {item.flag === 'notify_class_reminder' && (
              <Select
                aria-label="上課提醒時間"
                style={{ width: 150 }}
                disabled={!settings.notify_class_reminder}
                value={settings.reminder_hour}
                onChange={(v) => mutation.mutate({ reminder_hour: v })}
                options={REMINDER_HOURS.map((h) => ({ value: h, label: `前一天 ${String(h).padStart(2, '0')}:00` }))}
              />
            )}
          </div>
        ))}
      </div>

      <Collapse
        ghost
        size="small"
        onChange={(keys) => setLogOpen(keys.length > 0)}
        items={[
          {
            key: 'log',
            label: '最近的通知紀錄',
            children: (
              <Table
                rowKey="id"
                size="small"
                loading={logsLoading}
                columns={columns}
                dataSource={logs}
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                scroll={{ x: 640 }}
                locale={{ emptyText: '還沒有發送過會員通知' }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

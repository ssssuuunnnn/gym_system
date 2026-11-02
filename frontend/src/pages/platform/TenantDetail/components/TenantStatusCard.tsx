import { useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Divider,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Space,
  Statistic,
  Typography,
} from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { extendTrial, setTenantStatus, TENANT_STATUSES, type Tenant, type TenantStatus } from '../../../../api/platform';
import { apiErrorMessage } from '../../../../api/platformClient';
import StatusTag from '../../../../components/StatusTag';
import { TrialBadge } from '../../../../components/platform/TrialBadge';
import { formatServerTime } from '../../../../lib/datetime';

const STATUS_HINT: Record<TenantStatus, string> = {
  試用: '可正常使用，尚未正式簽約；有到期日的話，到期後後台、會員預約與形象網站會暫停',
  啟用: '正式使用中',
  停用: '該家所有網址都無法使用（含已登入的人），資料保留，重新啟用即恢復',
};

export interface TenantStatusCardProps {
  tenant: Tenant;
}

/** 狀態與使用概況：切換 試用／啟用／停用（停用需填原因），以及會員、教練、預約等彙總數字。 */
export function TenantStatusCard({ tenant }: TenantStatusCardProps) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState<number>(14);

  const mutation = useMutation({
    mutationFn: ({ status, reason }: { status: TenantStatus; reason?: string }) =>
      setTenantStatus(tenant.id, status, reason),
    onSuccess: (updated) => {
      queryClient.setQueryData(['platform-tenant', tenant.id], updated);
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-audit-logs'] });
      message.success(`已設為「${updated.status}」`);
      setSuspendOpen(false);
      setReason('');
    },
    onError: (err) => message.error(apiErrorMessage(err, '變更失敗')),
  });

  const extendMutation = useMutation({
    mutationFn: (days: number) => extendTrial(tenant.id, days),
    onSuccess: (updated) => {
      queryClient.setQueryData(['platform-tenant', tenant.id], updated);
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-audit-logs'] });
      message.success(`試用延長到 ${formatServerTime(updated.trial_ends_at, 'YYYY-MM-DD')}`);
      setExtendOpen(false);
    },
    onError: (err) => message.error(apiErrorMessage(err, '延長失敗')),
  });

  const others = TENANT_STATUSES.filter((s) => s !== tenant.status);

  return (
    <Card title="狀態與使用概況">
      <Space orientation="vertical" size={4}>
        <Space size={4}>
          <StatusTag status={tenant.status} />
          <TrialBadge tenant={tenant} />
          {tenant.signup_source === 'self' && <Typography.Text type="secondary">（形象頁自助申請）</Typography.Text>}
        </Space>
        <Typography.Text type="secondary">{STATUS_HINT[tenant.status]}</Typography.Text>
        {tenant.status === '試用' && (
          <Typography.Text>
            試用到期：
            {tenant.trial_ends_at ? formatServerTime(tenant.trial_ends_at, 'YYYY-MM-DD HH:mm') : '未設定（不會自動到期）'}
          </Typography.Text>
        )}
      </Space>
      {tenant.trial_expired && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 12 }}
          title="試用已到期：這家店的後台、會員預約與形象網站都已暫停。轉為正式請按「設為啟用」，或延長試用。"
        />
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {tenant.status === '試用' && (
          <Button type="primary" ghost onClick={() => setExtendOpen(true)}>
            延長試用
          </Button>
        )}
        {others.map((s) =>
          s === '停用' ? (
            <Button key={s} danger onClick={() => setSuspendOpen(true)}>
              停用
            </Button>
          ) : (
            <Popconfirm
              key={s}
              title={`設為「${s}」？`}
              description={STATUS_HINT[s]}
              okText="確定"
              cancelText="取消"
              onConfirm={() => mutation.mutateAsync({ status: s })}
            >
              <Button>設為{s}</Button>
            </Popconfirm>
          ),
        )}
      </div>

      <Divider />
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Statistic title="會員" value={tenant.stats.member_count} />
        </Col>
        <Col span={12}>
          <Statistic title="教練／美容師" value={tenant.stats.coach_count} />
        </Col>
        <Col span={12}>
          <Statistic title="本月預約" value={tenant.stats.reservations_this_month} />
        </Col>
        <Col span={12}>
          <Statistic title="管理員" value={tenant.stats.admin_count} />
        </Col>
      </Row>
      <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
        最後登入：{tenant.stats.last_login_at ? formatServerTime(tenant.stats.last_login_at) : '從未登入'}
        <br />
        開通日期：{formatServerTime(tenant.created_at, 'YYYY-MM-DD')}
      </Typography.Paragraph>

      <Modal
        open={extendOpen}
        title={`延長「${tenant.name}」的試用`}
        okText="延長"
        okButtonProps={{ disabled: !extendDays, loading: extendMutation.isPending }}
        cancelText="取消"
        onCancel={() => setExtendOpen(false)}
        onOk={() => extendMutation.mutate(extendDays)}
      >
        <Typography.Paragraph type="secondary">
          從今天或原到期日（較晚的那天）起再加上天數；已到期的店家延長後馬上恢復使用（約 30 秒內生效）。
        </Typography.Paragraph>
        <Space wrap>
          <Segmented<number>
            value={extendDays}
            onChange={setExtendDays}
            options={[
              { label: '7 天', value: 7 },
              { label: '14 天', value: 14 },
              { label: '30 天', value: 30 },
            ]}
          />
          <InputNumber
            aria-label="延長天數"
            min={1}
            max={365}
            value={extendDays}
            onChange={(v) => setExtendDays(v ?? 0)}
            suffix="天"
          />
        </Space>
      </Modal>

      <Modal
        open={suspendOpen}
        title={`停用「${tenant.name}」`}
        okText="停用"
        okButtonProps={{ danger: true, disabled: !reason.trim(), loading: mutation.isPending }}
        cancelText="取消"
        onCancel={() => setSuspendOpen(false)}
        onOk={() => mutation.mutate({ status: '停用', reason: reason.trim() })}
      >
        <Alert
          type="warning"
          showIcon
          title="停用後，這家店的管理員、教練／美容師、會員都無法使用系統（已登入的人也會被擋下，最多約 30 秒內生效）。資料會保留，重新啟用即恢復。"
          style={{ marginBottom: 16 }}
        />
        <Typography.Text>停用原因（會記在操作紀錄）</Typography.Text>
        <Input.TextArea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          autoSize={{ minRows: 2, maxRows: 4 }}
          placeholder="例如：未續約、帳款逾期"
          style={{ marginTop: 8 }}
        />
      </Modal>
    </Card>
  );
}

import { useState } from 'react';
import { Alert, App, Button, Card, Col, Divider, Input, Modal, Popconfirm, Row, Space, Statistic, Typography } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setTenantStatus, TENANT_STATUSES, type Tenant, type TenantStatus } from '../../../../api/platform';
import { apiErrorMessage } from '../../../../api/platformClient';
import StatusTag from '../../../../components/StatusTag';
import { formatServerTime } from '../../../../lib/datetime';

const STATUS_HINT: Record<TenantStatus, string> = {
  試用: '可正常使用，尚未正式簽約',
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

  const others = TENANT_STATUSES.filter((s) => s !== tenant.status);

  return (
    <Card title="狀態與使用概況">
      <Space orientation="vertical" size={4}>
        <StatusTag status={tenant.status} />
        <Typography.Text type="secondary">{STATUS_HINT[tenant.status]}</Typography.Text>
      </Space>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
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
          <Statistic title="教練" value={tenant.stats.coach_count} />
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
          title="停用後，這家健身房的管理員、教練、會員都無法使用系統（已登入的人也會被擋下，最多約 30 秒內生效）。資料會保留，重新啟用即恢復。"
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

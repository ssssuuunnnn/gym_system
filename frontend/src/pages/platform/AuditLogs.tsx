import { Card, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { listAuditLogs } from '../../api/platform';
import AuditLogTable from '../../components/platform/AuditLogTable';

/** 平台操作紀錄：所有健身房最近 200 筆開通、修改、停用與帳號操作。 */
export default function AuditLogs() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-audit-logs', 'all'],
    queryFn: () => listAuditLogs({ limit: 200 }),
  });
  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          操作紀錄
        </Typography.Title>
        <Typography.Text type="secondary">平台管理員與 CLI 的所有操作，最近 200 筆</Typography.Text>
      </div>
      <Card>
        <AuditLogTable logs={data} loading={isLoading} />
      </Card>
    </Space>
  );
}

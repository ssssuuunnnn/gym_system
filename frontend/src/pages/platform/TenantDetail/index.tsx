import { Breadcrumb, Card, Col, Result, Row, Skeleton, Space, Typography } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getTenant, listAuditLogs } from '../../../api/platform';
import AuditLogTable from '../../../components/platform/AuditLogTable';
import StatusTag from '../../../components/StatusTag';
import { tenantUrl } from '../../../lib/host';
import { TenantAdminsCard } from './components/TenantAdminsCard';
import { TenantInfoCard } from './components/TenantInfoCard';
import { TenantStatusCard } from './components/TenantStatusCard';

/** 店家詳情：基本資料、狀態與使用概況、管理員帳號、這家的操作紀錄。 */
export default function TenantDetail() {
  const tenantId = Number(useParams().id);
  const { data: tenant, isLoading, isError } = useQuery({
    queryKey: ['platform-tenant', tenantId],
    queryFn: () => getTenant(tenantId),
    enabled: Number.isFinite(tenantId),
  });
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['platform-audit-logs', { tenantId }],
    queryFn: () => listAuditLogs({ tenant_id: tenantId, limit: 100 }),
    enabled: Number.isFinite(tenantId),
  });

  if (isError) {
    return <Result status="404" title="找不到這家店" extra={<Link to="/tenants">回店家列表</Link>} />;
  }
  if (isLoading || !tenant) {
    return <Skeleton active />;
  }

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Breadcrumb items={[{ title: <Link to="/tenants">店家</Link> }, { title: tenant.name }]} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {tenant.name}
        </Typography.Title>
        <StatusTag status={tenant.status} />
        <Typography.Link href={tenantUrl(tenant.subdomain)} target="_blank">
          {tenantUrl(tenant.subdomain)} <ExportOutlined />
        </Typography.Link>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <TenantInfoCard tenant={tenant} />
        </Col>
        <Col xs={24} lg={8}>
          <TenantStatusCard tenant={tenant} />
        </Col>
      </Row>

      <TenantAdminsCard tenant={tenant} />

      <Card title="操作紀錄">
        <AuditLogTable logs={logs} loading={logsLoading} showTenant={false} pageSize={10} />
      </Card>
    </Space>
  );
}

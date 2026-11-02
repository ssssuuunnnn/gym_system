import { useMemo, useState } from 'react';
import { Button, Card, Col, Input, Row, Segmented, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ExportOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listTenants, TENANT_STATUSES, type Tenant, type TenantStatus } from '../../api/platform';
import StatusTag from '../../components/StatusTag';
import { TrialBadge, TRIAL_WARNING_DAYS } from '../../components/platform/TrialBadge';
import { formatServerTime } from '../../lib/datetime';
import { tenantUrl } from '../../lib/host';

type StatusFilter = TenantStatus | '全部' | '試用快到期' | '試用已到期';

const soonExpiring = (t: Tenant) =>
  t.status === '試用' && !t.trial_expired && t.trial_days_left != null && t.trial_days_left <= TRIAL_WARNING_DAYS;

function matchesStatus(t: Tenant, filter: StatusFilter) {
  if (filter === '全部') return true;
  if (filter === '試用快到期') return soonExpiring(t);
  if (filter === '試用已到期') return t.trial_expired;
  return t.status === filter;
}

/** 平台管理後台首頁：所有店家、狀態與使用概況。 */
export default function TenantList() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFilter>('全部');
  const [keyword, setKeyword] = useState('');

  // 一次取回全部，篩選在前端做：家數不多，切換篩選不必等網路，統計卡也能算全體
  const { data: tenants, isLoading } = useQuery({ queryKey: ['platform-tenants'], queryFn: () => listTenants() });

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return (tenants ?? []).filter(
      (t) =>
        matchesStatus(t, status) &&
        (!q || t.name.toLowerCase().includes(q) || t.subdomain.includes(q)),
    );
  }, [tenants, status, keyword]);

  const summary = useMemo(() => {
    const all = tenants ?? [];
    return {
      total: all.length,
      active: all.filter((t) => t.status === '啟用').length,
      trial: all.filter((t) => t.status === '試用').length,
      selfSignup: all.filter((t) => t.signup_source === 'self').length,
      reservations: all.reduce((sum, t) => sum + t.stats.reservations_this_month, 0),
    };
  }, [tenants]);

  const columns: ColumnsType<Tenant> = [
    {
      title: '店家',
      key: 'name',
      render: (_, t) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {t.name}
            {t.signup_source === 'self' && (
              <Tag color="cyan" style={{ marginInlineStart: 8 }}>
                自助申請
              </Tag>
            )}
          </div>
          <Typography.Link
            href={tenantUrl(t.subdomain)}
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 12 }}
          >
            {t.subdomain} <ExportOutlined />
          </Typography.Link>
        </div>
      ),
    },
    {
      title: '行業',
      dataIndex: 'business_type',
      width: 80,
      render: (b: Tenant['business_type']) => <Tag color={b === '美體' ? 'magenta' : 'blue'}>{b}</Tag>,
    },
    {
      title: '狀態',
      key: 'status',
      width: 150,
      render: (_, t) => (
        <Space size={4}>
          <StatusTag status={t.status} />
          <TrialBadge tenant={t} />
        </Space>
      ),
    },
    {
      title: '會員',
      key: 'members',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.stats.member_count - b.stats.member_count,
      render: (_, t) => t.stats.member_count,
    },
    {
      title: '教練／美容師',
      key: 'coaches',
      width: 140,
      align: 'right',
      sorter: (a, b) => a.stats.coach_count - b.stats.coach_count,
      render: (_, t) => t.stats.coach_count,
    },
    {
      title: '本月預約',
      key: 'reservations',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.stats.reservations_this_month - b.stats.reservations_this_month,
      render: (_, t) => t.stats.reservations_this_month,
    },
    {
      title: '最後登入',
      key: 'last_login',
      width: 160,
      sorter: (a, b) => (a.stats.last_login_at ?? '').localeCompare(b.stats.last_login_at ?? ''),
      render: (_, t) =>
        t.stats.last_login_at ? (
          formatServerTime(t.stats.last_login_at)
        ) : (
          <Typography.Text type="secondary">從未登入</Typography.Text>
        ),
    },
    {
      title: '開通日期',
      dataIndex: 'created_at',
      width: 120,
      render: (v: string) => formatServerTime(v, 'YYYY-MM-DD'),
    },
  ];

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          店家
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tenants/new')}>
          開通店家
        </Button>
      </div>

      <Row gutter={16}>
        {[
          { title: '店家總數', value: summary.total },
          { title: '啟用中', value: summary.active },
          { title: '試用中', value: summary.trial, suffix: `自助申請 ${summary.selfSignup}` },
          { title: '本月預約（全平台）', value: summary.reservations },
        ].map((s) => (
          <Col key={s.title} xs={12} md={6}>
            <Card size="small" loading={isLoading}>
              <Statistic
                title={s.title}
                value={s.value}
                suffix={'suffix' in s && <span style={{ fontSize: 12, marginInlineStart: 8 }}>{s.suffix}</span>}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <Input.Search
            allowClear
            placeholder="搜尋名稱或子網域"
            style={{ width: 260 }}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Segmented<StatusFilter>
            value={status}
            onChange={setStatus}
            options={['全部', ...TENANT_STATUSES, '試用快到期', '試用已到期']}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={isLoading}
          onRow={(t) => ({ onClick: () => navigate(`/tenants/${t.id}`), style: { cursor: 'pointer' } })}
          pagination={{ pageSize: 20, hideOnSinglePage: true, showTotal: (total) => `共 ${total} 家` }}
          locale={{ emptyText: tenants?.length ? '沒有符合條件的店家' : '還沒有店家，點右上角「開通店家」開始' }}
        />
      </Card>
    </Space>
  );
}

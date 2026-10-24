import { Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router-dom';
import type { AuditLog } from '../../api/platform';
import { formatServerTime } from '../../lib/datetime';

/** 健身房資料欄位的顯示名稱（修改紀錄用） */
const TENANT_FIELD_LABEL: Record<string, string> = {
  name: '名稱',
  timezone: '時區',
  contact_name: '聯絡人',
  contact_email: '聯絡 Email',
  contact_phone: '聯絡電話',
  note: '備註',
};

function text(value: unknown): string {
  return value === null || value === undefined || value === '' ? '（空）' : String(value);
}

/** 把操作紀錄的 detail 轉成一行人看得懂的說明 */
export function describeAuditDetail(log: AuditLog): string {
  const d = log.detail ?? {};
  switch (log.action) {
    case 'create_tenant':
      return [`子網域 ${d.subdomain}`, d.admin_username ? `管理員 ${d.admin_username}` : null]
        .filter(Boolean)
        .join('・');
    case 'update_tenant':
      return Object.entries(d)
        .map(([field, change]) => {
          const [from, to] = Array.isArray(change) ? change : [undefined, change];
          return `${TENANT_FIELD_LABEL[field] ?? field}：${text(from)} → ${text(to)}`;
        })
        .join('；');
    case 'set_status':
      return `${d.from} → ${d.to}${d.reason ? `（原因：${d.reason}）` : ''}`;
    case 'create_tenant_admin':
      return `帳號 ${d.username}`;
    case 'reset_tenant_admin_password':
      return `帳號 ${d.username}${d.must_change_password ? '（下次登入須修改密碼）' : ''}`;
    default:
      return log.detail ? JSON.stringify(log.detail) : '';
  }
}

export interface AuditLogTableProps {
  logs: AuditLog[] | undefined;
  loading?: boolean;
  /** 是否顯示「健身房」欄（在單一健身房的詳情頁可隱藏） */
  showTenant?: boolean;
  pageSize?: number;
}

/** 平台操作紀錄表格：操作紀錄頁與健身房詳情頁共用。 */
export default function AuditLogTable({ logs, loading, showTenant = true, pageSize = 20 }: AuditLogTableProps) {
  const columns: ColumnsType<AuditLog> = [
    {
      title: '時間',
      dataIndex: 'created_at',
      width: 150,
      render: (v: string) => formatServerTime(v),
    },
    ...(showTenant
      ? ([
          {
            title: '健身房',
            dataIndex: 'tenant_name',
            width: 180,
            render: (_: unknown, log: AuditLog) =>
              log.tenant_id ? <Link to={`/tenants/${log.tenant_id}`}>{log.tenant_name ?? `#${log.tenant_id}`}</Link> : '—',
          },
        ] as ColumnsType<AuditLog>)
      : []),
    { title: '操作', dataIndex: 'action_label', width: 160 },
    {
      title: '內容',
      key: 'detail',
      render: (_, log) => <Typography.Text type="secondary">{describeAuditDetail(log)}</Typography.Text>,
    },
    { title: '操作者', dataIndex: 'admin_username', width: 120 },
  ];

  return (
    <Table
      rowKey="id"
      size="middle"
      columns={columns}
      dataSource={logs}
      loading={loading}
      pagination={{ pageSize, hideOnSinglePage: true, showTotal: (total) => `共 ${total} 筆` }}
      locale={{ emptyText: '尚無操作紀錄' }}
    />
  );
}

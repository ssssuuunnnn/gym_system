import { useState } from 'react';
import { Select, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { CheckinRosterEntry } from '../../../../api/checkin';

type StatusFilter = 'all' | 'in' | 'no';

interface RosterPanelProps {
  entries: CheckinRosterEntry[];
  loading?: boolean;
  onCheckIn: (id: number) => void;
  onUndo: (id: number) => void;
}

/** 課程報到「名單與報到狀態」：狀態篩選 + 報到率 + 手動報到／取消報到。 */
export default function RosterPanel({ entries, loading, onCheckIn, onUndo }: RosterPanelProps) {
  const [status, setStatus] = useState<StatusFilter>('all');

  const checked = entries.filter((e) => e.checked_in_at !== null);
  const rate = entries.length ? `${Math.round((checked.length / entries.length) * 100)}%` : '—';
  const filtered = entries.filter((e) => {
    if (status === 'in') return e.checked_in_at !== null;
    if (status === 'no') return e.checked_in_at === null;
    return true;
  });

  const columns: ColumnsType<CheckinRosterEntry> = [
    { title: '會員', dataIndex: 'username' },
    {
      title: '報到時間',
      dataIndex: 'checked_in_at',
      render: (t: string | null) => (t ? dayjs(t).format('HH:mm') : '—'),
    },
    {
      title: '狀態',
      key: 'status',
      align: 'right',
      render: (_, r) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <Tag color={r.checked_in_at ? 'success' : 'default'}>{r.checked_in_at ? '已報到' : '未報到'}</Tag>
          {r.checked_in_at === null ? (
            <Typography.Link onClick={() => onCheckIn(r.id)} style={{ fontSize: 12 }}>
              手動報到
            </Typography.Link>
          ) : (
            <Typography.Link type="secondary" onClick={() => onUndo(r.id)} style={{ fontSize: 12 }}>
              取消報到
            </Typography.Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Select
          size="small"
          style={{ width: 130 }}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: '全部狀態' },
            { value: 'in', label: '已報到' },
            { value: 'no', label: '未報到' },
          ]}
        />
        <div style={{ flex: 1 }} />
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          報到率 {rate}
        </Typography.Text>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        loading={loading}
        pagination={false}
        locale={{ emptyText: '這個條件下沒有會員' }}
      />
    </div>
  );
}

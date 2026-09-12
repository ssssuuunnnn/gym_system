import { Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { SettlementSessionDetail, SettlementSessionType } from '../../../../api/settlements';
import { formatMinutes } from '../../../../components/calendar/shared';
import { formatCurrency } from '../../../../lib/currency';

const TYPE_TAG_COLOR: Record<SettlementSessionType, string> = {
  團體課程: 'processing',
  一對一: 'success',
  場租: 'default',
};

interface SettlementDetailTableProps {
  sessions: SettlementSessionDetail[];
}

/** 教練結算清單展開列的堂次明細（教練費用結算頁）。 */
export default function SettlementDetailTable({ sessions }: SettlementDetailTableProps) {
  const columns: ColumnsType<SettlementSessionDetail> = [
    {
      title: '類型',
      dataIndex: 'session_type',
      width: 96,
      render: (type: SettlementSessionType) => <Tag color={TYPE_TAG_COLOR[type]}>{type}</Tag>,
    },
    { title: '課程名稱', dataIndex: 'course_name' },
    {
      title: '上課時間',
      key: 'time',
      width: 160,
      render: (_, r) => `${dayjs(r.session_date).format('YYYY-MM-DD')} ${formatMinutes(r.start_minute)}`,
    },
    {
      title: '鐘點費',
      dataIndex: 'rate',
      width: 100,
      align: 'right',
      render: (rate: string) => formatCurrency(Number(rate)),
    },
    {
      title: '小計',
      dataIndex: 'subtotal',
      width: 100,
      align: 'right',
      render: (subtotal: string) => formatCurrency(Number(subtotal)),
    },
  ];

  return (
    <Table
      rowKey={(r) => `${r.course_name}-${r.session_date}-${r.start_minute}`}
      size="small"
      columns={columns}
      dataSource={sessions}
      pagination={false}
    />
  );
}

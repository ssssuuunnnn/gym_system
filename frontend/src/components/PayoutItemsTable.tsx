import { Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { PayoutItem } from '../api/coachPayouts';
import { weekdayLabel } from '../lib/weekday';
import { isoWeekday } from '../lib/availability';

/**
 * 教練鐘點明細表：一列＝一堂計費課（私人課一筆預約，費用＝教練私人課費率；
 * 團體課同課程同日同時段算一堂，費用＝課程每堂教練費）。
 * 管理員「教練鐘點」與教練「我的鐘點」共用。
 */
export default function PayoutItemsTable({ items, loading }: { items: PayoutItem[] | undefined; loading?: boolean }) {
  const columns: ColumnsType<PayoutItem> = [
    {
      title: '日期',
      key: 'date',
      render: (_, i) => {
        const d = dayjs(i.session_date);
        return `${d.format('MM/DD')}（${weekdayLabel(isoWeekday(d))}） ${i.start_hour}:00`;
      },
    },
    { title: '類型', dataIndex: 'kind' },
    { title: '課程', dataIndex: 'title' },
    {
      title: '費用',
      dataIndex: 'fee',
      render: (fee: number) =>
        fee > 0 ? `NT$ ${fee.toLocaleString('zh-TW')}` : <Typography.Text type="warning">NT$ 0（未設定）</Typography.Text>,
    },
    {
      title: '出席／未到',
      key: 'attendance',
      render: (_, i) => (
        <span>
          {i.attended_count}
          <Typography.Text type="secondary"> ／ </Typography.Text>
          {i.no_show_count > 0 ? <Typography.Text type="danger">{i.no_show_count}</Typography.Text> : 0}
        </span>
      ),
    },
    { title: '學員', dataIndex: 'members' },
  ];

  return (
    <Table
      size="small"
      rowKey={(i) => `${i.kind}-${i.course_id ?? 'p'}-${i.session_date}-${i.start_hour}-${i.members}`}
      columns={columns}
      dataSource={items}
      loading={loading}
      pagination={false}
      locale={{ emptyText: '本月沒有計費堂數' }}
    />
  );
}

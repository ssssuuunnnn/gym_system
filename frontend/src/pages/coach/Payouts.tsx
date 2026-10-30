import { Card, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { getPayout, listMyPayouts, type CoachPayout } from '../../api/coachPayouts';
import PayoutItemsTable from '../../components/PayoutItemsTable';
import StatusTag from '../../components/StatusTag';
import { formatServerTime } from '../../lib/datetime';
import { useTerms } from '../../lib/terms';

const money = (n: number) => `NT$ ${n.toLocaleString('zh-TW')}`;

function PayoutDetail({ id }: { id: number }) {
  const { data, isLoading } = useQuery({ queryKey: ['coach-payout', id], queryFn: () => getPayout(id) });
  return <PayoutItemsTable items={data?.items} loading={isLoading} />;
}

/**
 * 我的鐘點（私人教練／團體課程教練）：工作室已結算的每月鐘點費與明細。
 * 尚未結算的月份不顯示；有疑問請聯絡工作室。
 */
export default function MyPayouts() {
  const { t } = useTerms();
  const { data, isLoading } = useQuery({ queryKey: ['my-coach-payouts'], queryFn: listMyPayouts });

  const columns: ColumnsType<CoachPayout> = [
    { title: '月份', dataIndex: 'period', render: (v: string) => dayjs(v).format('YYYY-MM') },
    { title: t.hours, dataIndex: 'session_count' },
    { title: '金額', dataIndex: 'amount', render: (v: number) => <Typography.Text strong>{money(v)}</Typography.Text> },
    { title: '狀態', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
    {
      title: '撥款',
      key: 'paid',
      render: (_, p) =>
        p.paid_at ? `${formatServerTime(p.paid_at, 'YYYY-MM-DD')}${p.payment_note ? `（${p.payment_note}）` : ''}` : '—',
    },
  ];

  return (
    <Card>
      <Typography.Title level={4} style={{ marginBottom: 4 }}>
        我的鐘點
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        工作室每月結算後會顯示在這裡；已出席與未到的{t.hours}都會計入。{t.private}依你的每{t.unit}費用計算{t.unit === '堂' ? '，團體課依各課程設定的費用（同一時段算一次）' : ''}。
      </Typography.Paragraph>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={isLoading}
        pagination={{ pageSize: 12 }}
        expandable={{ expandedRowRender: (p) => <PayoutDetail id={p.id} /> }}
        locale={{ emptyText: '尚無結算紀錄' }}
      />
    </Card>
  );
}

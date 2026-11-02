import { App, Button, Popconfirm, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { closeMonth, listCloses, reopenMonth, type AccountingClose, type CloseTotals } from '../../../../api/accounting';
import { apiErrorMessage } from '../../../../api/errors';
import { formatServerTime } from '../../../../lib/datetime';
import { usePermissions } from '../../../../lib/permissions';
import { ACCOUNTING_KEYS, signedMoney } from '../lib';

/** 列出最近幾個已結束的月份 */
const MONTHS_SHOWN = 12;

interface MonthRow {
  month: string;
  close: AccountingClose | null;
}

function Totals({ totals }: { totals?: CloseTotals }) {
  if (!totals) return <>—</>;
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {signedMoney(totals.net)}
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
        收 {totals.income.toLocaleString('zh-TW')}／支 {totals.expense.toLocaleString('zh-TW')}
      </Typography.Text>
    </span>
  );
}

/**
 * 關帳（R63）：已結束的月份可以關帳，關帳後該月的手動帳目鎖住，並存下當時的數字；
 * 重新開帳只有主要管理者可以。
 */
export function ClosesTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { isOwner } = usePermissions();
  const closes = useQuery({ queryKey: ['accounting-closes'], queryFn: listCloses });

  const byMonth = new Map((closes.data ?? []).map((c) => [c.period.slice(0, 7), c]));
  const rows: MonthRow[] = Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const month = dayjs().subtract(i + 1, 'month').format('YYYY-MM');
    return { month, close: byMonth.get(month) ?? null };
  });

  const refresh = () => ACCOUNTING_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  const close = useMutation({
    mutationFn: closeMonth,
    onSuccess: (c) => {
      message.success(`${dayjs(c.period).format('YYYY 年 M 月')}已關帳`);
      refresh();
    },
    onError: (error) => message.error(apiErrorMessage(error, '關帳失敗，請稍後再試')),
  });
  const reopen = useMutation({
    mutationFn: reopenMonth,
    onSuccess: (c) => {
      message.success(`${dayjs(c.period).format('YYYY 年 M 月')}已重新開帳`);
      refresh();
    },
    onError: (error) => message.error(apiErrorMessage(error, '重新開帳失敗，請稍後再試')),
  });

  const columns: ColumnsType<MonthRow> = [
    { title: '月份', dataIndex: 'month', width: 100 },
    {
      title: '狀態',
      key: 'status',
      width: 110,
      render: (_, r) =>
        r.close?.is_closed ? <Tag color="green">已關帳</Tag> : r.close ? <Tag color="orange">重新開帳</Tag> : <Tag>未關帳</Tag>,
    },
    { title: '現金制淨額', key: 'cash', align: 'right', render: (_, r) => <Totals totals={r.close?.snapshot.cash} /> },
    { title: '權責制淨額', key: 'accrual', align: 'right', render: (_, r) => <Totals totals={r.close?.snapshot.accrual} /> },
    {
      title: '月底預收款',
      key: 'deferred',
      align: 'right',
      render: (_, r) => (r.close?.snapshot.deferred != null ? signedMoney(r.close.snapshot.deferred) : '—'),
    },
    {
      title: '紀錄',
      key: 'log',
      render: (_, r) =>
        r.close ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.close.closed_by_name} 關帳於 {formatServerTime(r.close.closed_at)}
            {r.close.reopened_at && (
              <>
                <br />
                {r.close.reopened_by_name} 重新開帳於 {formatServerTime(r.close.reopened_at)}
              </>
            )}
          </Typography.Text>
        ) : (
          '—'
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      render: (_, r) =>
        r.close?.is_closed ? (
          isOwner ? (
            <Popconfirm
              title={`重新開帳 ${r.month}？`}
              description="開帳後可以再修改這個月的帳目，之後請記得重新關帳"
              onConfirm={() => reopen.mutate(r.month)}
            >
              <Button size="small">重新開帳</Button>
            </Popconfirm>
          ) : null
        ) : (
          <Popconfirm
            title={`關帳 ${r.month}？`}
            description="關帳後這個月的手動帳目就不能新增、修改或刪除"
            onConfirm={() => close.mutate(r.month)}
          >
            <Button size="small" type="primary">
              關帳
            </Button>
          </Popconfirm>
        ),
    },
  ];

  return (
    <>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        月份結束後可以關帳：該月的手動帳目與收據會鎖住，並存下關帳當下的現金制、權責制數字與月底預收款，方便日後對照。
        重新開帳只有主要管理者可以。
      </Typography.Paragraph>
      <Table
        rowKey="month"
        size="small"
        columns={columns}
        dataSource={rows}
        loading={closes.isLoading}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </>
  );
}

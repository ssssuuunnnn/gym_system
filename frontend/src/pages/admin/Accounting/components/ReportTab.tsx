import { useState } from 'react';
import { Alert, Button, Card, Col, Collapse, Row, Segmented, Space, Statistic, Table, Tag, Typography, theme } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import {
  BASIS_LABEL,
  getReport,
  getTrend,
  listTransactions,
  type Basis,
  type ReportLine,
  type Transaction,
} from '../../../../api/accounting';
import { useTerms } from '../../../../lib/terms';
import { exportTransactions, money, signedMoney, SOURCE_LABEL, type Range } from '../lib';
import { TrendChart } from './TrendChart';

export interface ReportTabProps {
  range: Range;
  /** null＝全部分店 */
  branchId: number | null;
  branchName: (id: number | null) => string;
  /** 現金制／權責制 */
  basis: Basis;
}

const TREND_MONTHS = 12;

type KindFilter = '全部' | '收入' | '支出';
const KIND_FILTERS: KindFilter[] = ['全部', '收入', '支出'];

function LinesTable({ lines, total, empty }: { lines: ReportLine[]; total: number; empty: string }) {
  const columns: ColumnsType<ReportLine> = [
    {
      title: '項目',
      dataIndex: 'label',
      render: (label: string, line) => (
        <Space size={6}>
          {label}
          {line.source === 'manual' && <Tag bordered={false}>手動</Tag>}
        </Space>
      ),
    },
    { title: '筆數', dataIndex: 'count', align: 'right', width: 72 },
    { title: '金額', dataIndex: 'amount', align: 'right', render: (v: number) => money(v) },
    {
      title: '佔比',
      key: 'share',
      align: 'right',
      width: 72,
      render: (_, line) => (total > 0 ? `${Math.round((line.amount / total) * 100)}%` : '—'),
    },
  ];
  return (
    <Table
      rowKey="key"
      size="small"
      columns={columns}
      dataSource={lines}
      pagination={false}
      locale={{ emptyText: empty }}
    />
  );
}

/** 報表：期間的收入、支出、淨額，收支組成，近 12 個月趨勢，以及可匯出的明細 */
export function ReportTab({ range, branchId, branchName, basis }: ReportTabProps) {
  const { token } = theme.useToken();
  const { t } = useTerms();
  const period = {
    start: range[0].format('YYYY-MM-DD'),
    end: range[1].format('YYYY-MM-DD'),
    branch_id: branchId,
    basis,
  };
  const [kindFilter, setKindFilter] = useState<KindFilter>('全部');

  const report = useQuery({ queryKey: ['accounting-report', period], queryFn: () => getReport(period) });
  const trend = useQuery({
    queryKey: ['accounting-trend', TREND_MONTHS, branchId, basis],
    queryFn: () => getTrend(TREND_MONTHS, branchId, basis),
  });
  const txns = useQuery({ queryKey: ['accounting-transactions', period], queryFn: () => listTransactions(period) });

  const r = report.data;
  const rows = (txns.data ?? []).filter((t) => kindFilter === '全部' || t.kind === kindFilter);

  const txnColumns: ColumnsType<Transaction> = [
    { title: '日期', dataIndex: 'date', width: 110 },
    {
      title: '收支',
      dataIndex: 'kind',
      width: 72,
      render: (kind: string) => <Tag color={kind === '收入' ? 'blue' : 'orange'}>{kind}</Tag>,
    },
    { title: '分類', dataIndex: 'category', render: (c: string, t) => `${c}${t.source === 'manual' ? '' : `（${SOURCE_LABEL[t.source]}）`}` },
    { title: '說明', dataIndex: 'description', ellipsis: true },
    { title: '付款方式', dataIndex: 'payment_method', width: 88, render: (m: string | null) => m ?? '—' },
    {
      title: '分店',
      dataIndex: 'branch_id',
      width: 100,
      render: (id: number | null) => (id == null ? <Typography.Text type="secondary">全店共同</Typography.Text> : branchName(id)),
    },
    {
      title: '金額',
      dataIndex: 'amount',
      align: 'right',
      width: 120,
      render: (v: number, t) => (t.kind === '支出' ? signedMoney(-v) : money(v)),
    },
  ];

  const sharedNote =
    r?.shared && (r.shared.income > 0 || r.shared.expense > 0)
      ? `全店共同（沒有指定分店）的手動帳目不計入分店報表：收入 ${money(r.shared.income)}、支出 ${money(r.shared.expense)}。`
      : null;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card size="small" loading={report.isLoading}>
            <Statistic title="收入" value={r?.income ?? 0} formatter={(v) => money(Number(v))} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" loading={report.isLoading}>
            <Statistic title="支出" value={r?.expense ?? 0} formatter={(v) => money(Number(v))} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" loading={report.isLoading}>
            <Statistic
              title="淨額（收入 − 支出）"
              value={r?.net ?? 0}
              formatter={(v) => signedMoney(Number(v))}
              valueStyle={{ color: (r?.net ?? 0) < 0 ? token.colorError : token.colorSuccess }}
              prefix={(r?.net ?? 0) < 0 ? <ArrowDownOutlined /> : <ArrowUpOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {sharedNote && <Alert type="info" showIcon message={sharedNote} />}
      {r && r.basis === 'accrual' && r.months_without_payouts.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`${r.months_without_payouts.join('、')} 還沒有結算${t.staffPay}，權責制的支出暫時不含這幾個月的${t.staffPay}。`}
        />
      )}
      {r && r.closed_months.length > 0 && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          已關帳：{r.closed_months.join('、')}
        </Typography.Text>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="收入組成" loading={report.isLoading}>
            <LinesTable lines={r?.income_lines ?? []} total={r?.income ?? 0} empty="這段期間沒有收入" />
            {r && r.payment_methods.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  付款方式：
                  {r.payment_methods.map((m) => `${m.method} ${money(m.amount)}（${m.count} 筆）`).join('、')}
                </Typography.Text>
              </div>
            )}
            {r && (r.discount_total > 0 || r.zero_amount_count > 0) && (
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                {r.discount_total > 0 && `優惠折抵共 ${money(r.discount_total)}（收入已扣除）`}
                {r.discount_total > 0 && r.zero_amount_count > 0 && '；'}
                {r.zero_amount_count > 0 && `體驗券兌換 ${r.zero_amount_count} 筆（0 元）`}
              </Typography.Text>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="支出組成" loading={report.isLoading}>
            <LinesTable lines={r?.expense_lines ?? []} total={r?.expense ?? 0} empty="這段期間沒有支出" />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={`近 ${TREND_MONTHS} 個月`} loading={trend.isLoading}>
        <TrendChart data={trend.data ?? []} />
        <Collapse
          ghost
          size="small"
          style={{ marginTop: 8 }}
          items={[
            {
              key: 'table',
              label: '看數字',
              children: (
                <Table
                  rowKey="month"
                  size="small"
                  pagination={false}
                  dataSource={[...(trend.data ?? [])].reverse()}
                  columns={[
                    { title: '月份', dataIndex: 'month' },
                    { title: '收入', dataIndex: 'income', align: 'right', render: (v: number) => money(v) },
                    { title: '支出', dataIndex: 'expense', align: 'right', render: (v: number) => money(v) },
                    { title: '淨額', dataIndex: 'net', align: 'right', render: (v: number) => signedMoney(v) },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>

      <Card
        size="small"
        title="明細"
        extra={
          <Space wrap>
            <Segmented<KindFilter> size="small" value={kindFilter} onChange={setKindFilter} options={KIND_FILTERS} />
            <Button
              size="small"
              icon={<DownloadOutlined />}
              disabled={!txns.data?.length}
              onClick={() => exportTransactions(txns.data ?? [], range, branchName, BASIS_LABEL[basis])}
            >
              匯出 CSV
            </Button>
          </Space>
        }
      >
        <Table
          rowKey={(t) => `${t.source}-${t.ref_id}-${t.branch_id ?? 0}`}
          size="small"
          columns={txnColumns}
          dataSource={rows}
          loading={txns.isLoading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showTotal: (n) => `共 ${n} 筆` }}
        />
      </Card>
    </Space>
  );
}

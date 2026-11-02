import { useState } from 'react';
import { Card, Col, DatePicker, Row, Space, Statistic, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { getDeferred, type DeferredLine } from '../../../../api/accounting';
import { useTerms } from '../../../../lib/terms';
import { money } from '../lib';

export interface DeferredTabProps {
  /** null＝全部分店（預收款以購買的分店計） */
  branchId: number | null;
}

/** 預收款（R62）：已收錢、還沒上課的金額與堂數，可以看任一天結束時的餘額 */
export function DeferredTab({ branchId }: DeferredTabProps) {
  const { t } = useTerms();
  const [asOf, setAsOf] = useState<Dayjs>(() => dayjs());
  const key = asOf.format('YYYY-MM-DD');
  const query = useQuery({
    queryKey: ['accounting-deferred', key, branchId],
    queryFn: () => getDeferred(key, branchId),
  });
  const d = query.data;

  const columns: ColumnsType<DeferredLine> = [
    { title: '方案', dataIndex: 'label' },
    { title: '類別', dataIndex: 'category', width: 100 },
    { title: '筆數', dataIndex: 'count', align: 'right', width: 72 },
    { title: `未上${t.hours}`, dataIndex: 'hours', align: 'right', width: 100, render: (h: number) => h.toLocaleString('zh-TW') },
    { title: '預收金額', dataIndex: 'amount', align: 'right', render: (v: number) => money(v) },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space wrap>
        <Typography.Text>截至</Typography.Text>
        <DatePicker
          value={asOf}
          allowClear={false}
          disabledDate={(day) => day.isAfter(dayjs(), 'day')}
          onChange={(v) => v && setAsOf(v)}
        />
        <Typography.Text type="secondary">當天結束時</Typography.Text>
      </Space>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card size="small" loading={query.isLoading}>
            <Statistic title="預收款餘額" value={d?.total ?? 0} formatter={(v) => money(Number(v))} />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card size="small" loading={query.isLoading}>
            <Statistic title={`未上${t.hours}`} value={d?.hours ?? 0} suffix={t.unit} />
          </Card>
        </Col>
      </Row>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
        已收款的{t.service}方案，扣掉已經上完的{t.unit}數所對應的金額（每{t.unit}價值＝實收金額 ÷ 購買{t.hours}）。
        已預約但還沒到{t.attend}日的仍算預收；分店以購買時的分店計。
      </Typography.Paragraph>
      <Table
        rowKey="product_id"
        size="small"
        columns={columns}
        dataSource={d?.lines}
        loading={query.isLoading}
        pagination={false}
        locale={{ emptyText: '沒有預收款' }}
      />
    </Space>
  );
}

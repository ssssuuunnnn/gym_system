import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import {
  getLivePayoutItems,
  getPayout,
  getPayoutSummary,
  markPayoutPaid,
  settlePayout,
  voidPayout,
  type CoachPayoutSummaryRow,
} from '../../api/coachPayouts';
import { listCoaches } from '../../api/coaches';
import PayoutItemsTable from '../../components/PayoutItemsTable';
import StatusTag from '../../components/StatusTag';
import { formatServerTime } from '../../lib/datetime';

const money = (n: number) => `NT$ ${n.toLocaleString('zh-TW')}`;

function errorDetail(error: unknown, fallback: string) {
  const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
  return typeof detail === 'string' ? detail : fallback;
}

/** 展開列：已結算看快照明細，未結算看即時明細 */
function RowDetail({ row, month }: { row: CoachPayoutSummaryRow; month: string }) {
  const payoutId = row.payout?.id;
  const settled = useQuery({
    queryKey: ['coach-payout', payoutId],
    queryFn: () => getPayout(payoutId as number),
    enabled: payoutId != null,
  });
  const live = useQuery({
    queryKey: ['coach-payout-live', row.coach_id, month],
    queryFn: () => getLivePayoutItems(row.coach_id, month),
    enabled: payoutId == null,
  });
  return payoutId != null ? (
    <PayoutItemsTable items={settled.data?.items} loading={settled.isLoading} />
  ) : (
    <PayoutItemsTable items={live.data} loading={live.isLoading} />
  );
}

/**
 * 教練鐘點：依出席紀錄計算私人教練／團體課程教練每月堂數與鐘點費（已出席＋未到）。
 * 私人課＝教練私人課費率；團體課一堂算一次＝課程每堂教練費。場租教練不列。
 * 月份結束後可結算（鎖定快照）、標記已撥款；已結算未撥款可取消結算重算。規則見 docs/business-rules.md R11–R13。
 */
export default function CoachPayouts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [monthValue, setMonthValue] = useState<Dayjs>(dayjs().subtract(1, 'month').startOf('month'));
  const month = monthValue.format('YYYY-MM');
  const monthEnded = dayjs().isAfter(monthValue.endOf('month'));
  const [paying, setPaying] = useState<CoachPayoutSummaryRow | null>(null);
  const [paymentNote, setPaymentNote] = useState('');

  const { data: rows, isLoading } = useQuery({
    queryKey: ['coach-payouts-summary', month],
    queryFn: () => getPayoutSummary(month),
  });
  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const coachById = new Map((coaches ?? []).map((c) => [c.id, c]));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['coach-payouts-summary'] });
    queryClient.invalidateQueries({ queryKey: ['coach-payout'] });
    queryClient.invalidateQueries({ queryKey: ['coach-payout-live'] });
  };

  const settleMutation = useMutation({
    mutationFn: (coachId: number) => settlePayout(coachId, month),
    onSuccess: (p) => {
      message.success(`已結算 ${p.session_count} 堂，${money(p.amount)}`);
      invalidate();
    },
    onError: (e) => message.error(errorDetail(e, '結算失敗，請稍後再試')),
  });

  const paidMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string | null }) => markPayoutPaid(id, note),
    onSuccess: () => {
      message.success('已標記撥款');
      setPaying(null);
      setPaymentNote('');
      invalidate();
    },
    onError: (e) => message.error(errorDetail(e, '標記失敗，請稍後再試')),
  });

  const voidMutation = useMutation({
    mutationFn: voidPayout,
    onSuccess: () => {
      message.success('已取消結算');
      invalidate();
    },
    onError: (e) => message.error(errorDetail(e, '取消結算失敗，請稍後再試')),
  });

  const columns: ColumnsType<CoachPayoutSummaryRow> = [
    {
      title: '教練',
      dataIndex: 'coach_name',
    },
    {
      title: '類型',
      dataIndex: 'coach_types',
      render: (types: CoachPayoutSummaryRow['coach_types']) => (
        <Space size={4} wrap>
          {types.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '私人課費率',
      key: 'rate',
      render: (_, r) =>
        !r.coach_types.includes('私人教練') ? (
          '—'
        ) : r.session_rate > 0 ? (
          `${money(r.session_rate)}／堂`
        ) : (
          <Space size={4}>
            <Typography.Text type="warning">未設定</Typography.Text>
            <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/admin/coaches/${r.coach_id}/edit`)}>
              去設定
            </Button>
          </Space>
        ),
    },
    {
      title: '堂數',
      key: 'count',
      render: (_, r) => r.payout?.session_count ?? r.live_session_count,
    },
    {
      title: '金額',
      key: 'amount',
      render: (_, r) => <Typography.Text strong>{money(r.payout?.amount ?? r.live_amount)}</Typography.Text>,
    },
    {
      title: '狀態',
      key: 'status',
      render: (_, r) => (
        <Space size={4}>
          {r.payout ? <StatusTag status={r.payout.status} /> : <Tag>未結算</Tag>}
          {!r.payout && r.has_zero_fee && (
            <Tooltip title="有計費堂數的費用為 0：請確認教練的私人課費率，或團體課程的每堂教練費。">
              <Tag color="gold" icon={<WarningOutlined />}>
                費用未設定
              </Tag>
            </Tooltip>
          )}
          {r.changed_since_settled && (
            <Tooltip
              title={`結算後出席紀錄或費用有異動：目前即時計算為 ${r.live_session_count} 堂（${money(r.live_amount)}）。若要更新，請取消結算後重新結算。`}
            >
              <Tag color="orange" icon={<WarningOutlined />}>
                有異動
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '結算／撥款',
      key: 'when',
      render: (_, r) =>
        r.payout ? (
          <Space orientation="vertical" size={0}>
            <Typography.Text type="secondary">結算 {formatServerTime(r.payout.settled_at)}</Typography.Text>
            {r.payout.paid_at && (
              <Typography.Text type="secondary">
                撥款 {formatServerTime(r.payout.paid_at)}
                {r.payout.payment_note ? `（${r.payout.payment_note}）` : ''}
              </Typography.Text>
            )}
          </Space>
        ) : (
          '—'
        ),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      render: (_, r) => {
        if (!r.payout) {
          const disabledReason = !monthEnded
            ? '月份結束後才能結算'
            : r.live_session_count === 0
              ? '本月沒有計費堂數'
              : undefined;
          return (
            <Tooltip title={disabledReason}>
              <Popconfirm
                title={`結算 ${r.coach_name} ${month} 鐘點？`}
                description={`共 ${r.live_session_count} 堂，${money(r.live_amount)}，結算後金額鎖定。`}
                disabled={!!disabledReason}
                onConfirm={() => settleMutation.mutate(r.coach_id)}
              >
                <Button size="small" type="primary" disabled={!!disabledReason}>
                  結算
                </Button>
              </Popconfirm>
            </Tooltip>
          );
        }
        if (r.payout.status === '已結算') {
          return (
            <Space>
              <Button size="small" type="primary" onClick={() => setPaying(r)}>
                標記已撥款
              </Button>
              <Popconfirm
                title="取消這筆結算？"
                description="取消後可依目前的出席紀錄重新結算。"
                onConfirm={() => voidMutation.mutate(r.payout!.id)}
              >
                <Button size="small">取消結算</Button>
              </Popconfirm>
            </Space>
          );
        }
        return null;
      },
    },
  ];

  const total = (rows ?? []).reduce((sum, r) => sum + (r.payout?.amount ?? r.live_amount), 0);
  const unsetRate = (rows ?? []).some((r) => !r.payout && r.has_zero_fee);
  const payingCoach = paying ? coachById.get(paying.coach_id) : undefined;

  return (
    <Card>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          教練鐘點
        </Typography.Title>
        <DatePicker
          picker="month"
          allowClear={false}
          value={monthValue}
          onChange={(v) => v && setMonthValue(v.startOf('month'))}
          disabledDate={(d) => d.isAfter(dayjs(), 'month')}
        />
      </Space>

      {!monthEnded && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="本月尚未結束，以下為目前為止的即時計算，月份結束後才能結算。"
        />
      )}
      {unsetRate && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="有計費堂數的費用為 0：請到教練資料設定私人課鐘點費，或到團體課程設定每堂教練費。"
        />
      )}

      <Table
        rowKey="coach_id"
        columns={columns}
        dataSource={rows}
        loading={isLoading}
        pagination={false}
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowRender: (r) => <RowDetail row={r} month={month} />,
          rowExpandable: (r) => (r.payout?.session_count ?? r.live_session_count) > 0,
        }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={5}>
              <Typography.Text strong>{month} 合計</Typography.Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={5} colSpan={4}>
              <Typography.Text strong>{money(total)}</Typography.Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />

      <Modal
        title="標記已撥款"
        open={paying !== null}
        okText="確認已撥款"
        cancelText="取消"
        confirmLoading={paidMutation.isPending}
        onOk={() => paying?.payout && paidMutation.mutate({ id: paying.payout.id, note: paymentNote.trim() || null })}
        onCancel={() => setPaying(null)}
        destroyOnHidden
      >
        {paying?.payout && (
          <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="教練">{paying.coach_name}</Descriptions.Item>
            <Descriptions.Item label="月份">{month}</Descriptions.Item>
            <Descriptions.Item label="金額">{money(paying.payout.amount)}</Descriptions.Item>
            <Descriptions.Item label="匯款帳號">
              {payingCoach?.bank_code || payingCoach?.bank_account
                ? `(${payingCoach?.bank_code ?? '—'}) ${payingCoach?.bank_account ?? '—'}`
                : '未設定'}
            </Descriptions.Item>
          </Descriptions>
        )}
        <Input
          maxLength={255}
          placeholder="撥款備註（選填），例如：11/5 已匯款"
          value={paymentNote}
          onChange={(e) => setPaymentNote(e.target.value)}
        />
      </Modal>
    </Card>
  );
}

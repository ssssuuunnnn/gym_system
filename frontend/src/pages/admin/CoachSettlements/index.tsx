import { Alert, Breadcrumb, Button, Card, Popconfirm, Space, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import {
  getSettlement,
  getSettlementRates,
  lockSettlement,
  unlockSettlement,
  type CoachSettlementRow,
  type SettlementStatus,
} from '../../../api/settlements';
import { formatCurrency } from '../../../lib/currency';
import { downloadCsv } from '../../../lib/exportCsv';
import MonthNav from './components/MonthNav';
import RatePopover from './components/RatePopover';
import SettlementDetailTable from './components/SettlementDetailTable';

const STATUS_TAG_COLOR: Record<SettlementStatus, string> = {
  待確認: 'warning',
  已鎖定: 'success',
};

const UNTRACKED_TOOLTIP = '尚未追蹤此類型堂數';

/**
 * 教練費用結算：財務報表 → 每月（上月 1 號至月底）各教練應付鐘點費總覽與明細。
 * 目前僅團體課程有實際課堂資料可結算；一對一、場租尚無資料來源，欄位固定為 0。
 */
export default function CoachSettlements() {
  const queryClient = useQueryClient();
  const [anchorMonth, setAnchorMonth] = useState<Dayjs>(() => dayjs().subtract(1, 'month').startOf('month'));
  const [expandedRowKeys, setExpandedRowKeys] = useState<number[]>([]);

  const year = anchorMonth.year();
  const month = anchorMonth.month() + 1;

  const { data: summary, isLoading } = useQuery({
    queryKey: ['coach-settlement', year, month],
    queryFn: () => getSettlement(year, month),
  });
  const { data: rates } = useQuery({
    queryKey: ['coach-settlement-rates'],
    queryFn: getSettlementRates,
  });

  const lockMutation = useMutation({
    mutationFn: () => lockSettlement(year, month),
    onSuccess: () => {
      message.success(`已鎖定 ${year} 年 ${month} 月結算`);
      queryClient.invalidateQueries({ queryKey: ['coach-settlement', year, month] });
    },
    onError: () => message.error('鎖定失敗，請稍後再試'),
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlockSettlement(year, month),
    onSuccess: () => {
      message.success(`已解鎖 ${year} 年 ${month} 月結算`);
      queryClient.invalidateQueries({ queryKey: ['coach-settlement', year, month] });
    },
    onError: () => message.error('解鎖失敗，請稍後再試'),
  });

  const rows = summary?.rows ?? [];

  const handleExport = () => {
    const header = ['教練', '團體課(堂)', '一對一(堂)', '場租(堂)', '應付金額', '狀態'];
    const body = rows.map((r) => [
      r.coach_name,
      r.group_course_count,
      r.private_count,
      r.venue_rental_count,
      r.payable_amount,
      r.status,
    ]);
    downloadCsv(`教練費用結算_${year}${String(month).padStart(2, '0')}.csv`, [header, ...body]);
  };

  const columns: ColumnsType<CoachSettlementRow> = [
    { title: '教練', dataIndex: 'coach_name' },
    { title: '團體課', dataIndex: 'group_course_count', align: 'right', render: (v: number) => `${v} 堂` },
    {
      title: (
        <Space size={4}>
          一對一
          <Tooltip title={UNTRACKED_TOOLTIP}>
            <InfoCircleOutlined style={{ color: 'var(--ant-color-text-tertiary, #999)' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'private_count',
      align: 'right',
      render: (v: number) => `${v} 堂`,
    },
    {
      title: (
        <Space size={4}>
          場租
          <Tooltip title={UNTRACKED_TOOLTIP}>
            <InfoCircleOutlined style={{ color: 'var(--ant-color-text-tertiary, #999)' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'venue_rental_count',
      align: 'right',
      render: (v: number) => `${v} 堂`,
    },
    {
      title: '應付金額',
      dataIndex: 'payable_amount',
      align: 'right',
      render: (v: string) => <strong>{formatCurrency(Number(v))}</strong>,
    },
    {
      title: '狀態',
      dataIndex: 'status',
      align: 'center',
      render: (status: SettlementStatus) => <Tag color={STATUS_TAG_COLOR[status]}>{status}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      align: 'center',
      render: () => <Link to="/admin/coach-payouts">前往撥款</Link>,
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Breadcrumb items={[{ title: '財務報表' }, { title: '教練費用結算' }]} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            教練費用結算
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13, paddingBottom: 2 }}>
            依課程類型鐘點費計算，結算區間為上個月 1 號至月底
          </Typography.Text>
        </div>
        <MonthNav value={anchorMonth} onChange={setAnchorMonth} />
      </div>

      {summary && (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          結算範圍：{dayjs(summary.period_start).format('YYYY/MM/DD')} – {dayjs(summary.period_end).format('YYYY/MM/DD')}
        </Typography.Text>
      )}

      {summary?.is_locked && (
        <Alert
          type="success"
          showIcon
          message={`${year} 年 ${month} 月結算已鎖定，僅可查看，如需修改請先解鎖`}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <Card>
          <Statistic title="教練人數" value={summary?.coach_count ?? 0} suffix="位" />
        </Card>
        <Card>
          <Statistic
            title="本月應付總額"
            value={Number(summary?.total_payable ?? 0)}
            formatter={(v) => formatCurrency(Number(v))}
          />
        </Card>
        <Card>
          <Statistic
            title="結算狀態"
            value={summary?.is_locked ? '已鎖定' : '待確認'}
            valueStyle={{ color: summary?.is_locked ? '#52c41a' : '#faad14' }}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {summary?.is_locked ? '本月結算已鎖定，撥款請至撥款紀錄頁執行' : '請確認明細後鎖定本月結算'}
          </Typography.Text>
        </Card>
      </div>

      <Card
        title="教練結算清單"
        extra={<Typography.Text type="secondary">共 {rows.length} 位教練</Typography.Text>}
      >
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              依課程類型鐘點費：團體課程 NT${rates ? Number(rates.group_course_rate) : '-'} · 一對一 NT$
              {rates ? Number(rates.private_rate) : '-'} · 場租 NT${rates ? Number(rates.venue_rental_rate) : '-'}
            </Typography.Text>
            {rates && <RatePopover rates={rates} />}
            <div style={{ flex: 1 }} />
            <Button size="small" onClick={handleExport} disabled={!summary || rows.length === 0}>
              匯出報表
            </Button>
            {summary?.is_locked ? (
              <Popconfirm
                title={`確定要解鎖 ${year} 年 ${month} 月結算嗎？`}
                onConfirm={() => unlockMutation.mutate()}
              >
                <Button size="small" loading={unlockMutation.isPending}>
                  解鎖本月結算
                </Button>
              </Popconfirm>
            ) : (
              <Popconfirm
                title={`確定要鎖定 ${year} 年 ${month} 月結算嗎？鎖定後僅可查看，如需修改請先解鎖`}
                onConfirm={() => lockMutation.mutate()}
              >
                <Button size="small" type="primary" loading={lockMutation.isPending}>
                  鎖定本月結算
                </Button>
              </Popconfirm>
            )}
          </div>

          <Table
            rowKey="coach_id"
            columns={columns}
            dataSource={rows}
            loading={isLoading}
            pagination={false}
            expandable={{
              expandedRowKeys,
              onExpand: (expanded, record) =>
                setExpandedRowKeys((keys) =>
                  expanded ? [...keys, record.coach_id] : keys.filter((k) => k !== record.coach_id),
                ),
              expandedRowRender: (record) => <SettlementDetailTable sessions={record.sessions} />,
            }}
          />
        </Space>
      </Card>
    </Space>
  );
}

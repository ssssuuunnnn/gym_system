import { useState } from 'react';
import {
  Card,
  Typography,
  Table,
  Button,
  Space,
  Popconfirm,
  Modal,
  Form,
  Select,
  Input,
  Segmented,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import {
  cancelPurchase,
  confirmPayment,
  listPurchases,
  PAYMENT_METHODS,
  type PaymentMethod,
  type PaymentStatus,
  type Purchase,
} from '../../api/purchases';
import { listMembers } from '../../api/users';
import { listProducts } from '../../api/products';
import StatusTag from '../../components/StatusTag';
import { formatServerTime } from '../../lib/datetime';

type StatusFilter = PaymentStatus | '全部';
const STATUS_FILTERS: StatusFilter[] = ['待付款', '已付款', '已取消', '全部'];

interface ConfirmValues {
  payment_method: PaymentMethod;
  payment_note?: string;
}

function errorDetail(error: unknown, fallback: string) {
  const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
  return detail || fallback;
}

/**
 * 購買紀錄：列出所有會員的購買／訂單，預設顯示「待付款」。
 * 會員自助購買的訂單在此「確認收款」後才會入帳堂數；待付款訂單也可在此取消（用品歸還庫存）。
 */
export default function PurchaseList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('待付款');
  const [confirming, setConfirming] = useState<Purchase | null>(null);
  const [form] = Form.useForm<ConfirmValues>();

  const { data: purchases, isLoading } = useQuery({ queryKey: ['purchases', 'all'], queryFn: () => listPurchases() });
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: listProducts });

  const memberNameById = new Map((members ?? []).map((m) => [m.id, m.username]));
  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));

  const countByStatus = (status: StatusFilter) =>
    status === '全部' ? (purchases ?? []).length : (purchases ?? []).filter((p) => p.payment_status === status).length;
  const rows = statusFilter === '全部' ? purchases : (purchases ?? []).filter((p) => p.payment_status === statusFilter);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchases'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const confirmMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: ConfirmValues }) =>
      confirmPayment(id, { payment_method: values.payment_method, payment_note: values.payment_note || null }),
    onSuccess: (purchase) => {
      message.success(
        purchase.total_hours > 0 ? `已確認收款，入帳 ${purchase.total_hours} 堂` : '已確認收款',
      );
      setConfirming(null);
      form.resetFields();
      invalidate();
    },
    onError: (error) => message.error(errorDetail(error, '確認收款失敗，請稍後再試')),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelPurchase,
    onSuccess: () => {
      message.success('已取消訂單');
      invalidate();
    },
    onError: (error) => message.error(errorDetail(error, '取消失敗，請稍後再試')),
  });

  const columns: ColumnsType<Purchase> = [
    {
      title: '建立時間',
      dataIndex: 'created_at',
      render: (value: string) => formatServerTime(value),
    },
    {
      title: '會員',
      dataIndex: 'user_id',
      render: (id: number) => memberNameById.get(id) ?? `#${id}`,
    },
    {
      title: '商品',
      dataIndex: 'product_id',
      render: (id: number) => productNameById.get(id) ?? `#${id}`,
    },
    { title: '數量', dataIndex: 'quantity' },
    { title: '金額', dataIndex: 'amount', render: (amount: number) => `NT$ ${amount}` },
    {
      title: '堂數（剩餘／總計）',
      key: 'hours',
      render: (_, record) => (record.total_hours > 0 ? `${record.remaining_hours} / ${record.total_hours}` : '—'),
    },
    {
      title: '付款狀態',
      dataIndex: 'payment_status',
      render: (value: string) => <StatusTag status={value} />,
    },
    {
      title: '付款方式',
      key: 'payment',
      render: (_, record) =>
        record.payment_method ? (
          <Space orientation="vertical" size={0}>
            <span>{record.payment_method}</span>
            {record.payment_note && <Typography.Text type="secondary">{record.payment_note}</Typography.Text>}
          </Space>
        ) : (
          '—'
        ),
    },
    {
      title: '收款時間',
      dataIndex: 'paid_at',
      render: (value: string | null) => formatServerTime(value),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      render: (_, record) =>
        record.payment_status === '待付款' ? (
          <Space>
            <Button size="small" type="primary" onClick={() => setConfirming(record)}>
              確認收款
            </Button>
            <Popconfirm title="確定要取消這筆訂單？" onConfirm={() => cancelMutation.mutate(record.id)}>
              <Button size="small" danger>
                取消
              </Button>
            </Popconfirm>
          </Space>
        ) : null,
    },
  ];

  return (
    <Card>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          購買紀錄
        </Typography.Title>
        <Button onClick={() => navigate('/admin/products/purchase-entry')}>登錄購買</Button>
      </Space>

      <Segmented<StatusFilter>
        style={{ marginBottom: 16 }}
        value={statusFilter}
        onChange={setStatusFilter}
        options={STATUS_FILTERS.map((s) => ({ value: s, label: `${s}（${countByStatus(s)}）` }))}
      />

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={isLoading}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="確認收款"
        open={confirming !== null}
        okText="確認收款"
        cancelText="取消"
        confirmLoading={confirmMutation.isPending}
        onOk={() => form.submit()}
        onCancel={() => {
          setConfirming(null);
          form.resetFields();
        }}
        destroyOnHidden
      >
        {confirming && (
          <Typography.Paragraph>
            {memberNameById.get(confirming.user_id) ?? `#${confirming.user_id}`}｜
            {productNameById.get(confirming.product_id) ?? `#${confirming.product_id}`} × {confirming.quantity}｜應收 NT${' '}
            {confirming.amount}
            {confirming.total_hours > 0 && `｜確認後入帳 ${confirming.total_hours} 堂`}
          </Typography.Paragraph>
        )}
        <Form<ConfirmValues>
          form={form}
          layout="vertical"
          onFinish={(values) => confirming && confirmMutation.mutate({ id: confirming.id, values })}
        >
          <Form.Item name="payment_method" label="付款方式" rules={[{ required: true, message: '請選擇付款方式' }]}>
            <Select placeholder="選擇付款方式" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
          </Form.Item>
          <Form.Item name="payment_note" label="收款備註（選填）">
            <Input maxLength={255} placeholder="例如：轉帳末五碼 12345" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

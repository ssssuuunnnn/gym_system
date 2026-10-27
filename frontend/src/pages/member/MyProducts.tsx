import { Card, Typography, Table, Button, Popconfirm, Alert, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { isAxiosError } from 'axios';
import { cancelPurchase, listPurchases, type Purchase } from '../../api/purchases';
import { listProducts } from '../../api/products';
import { getSettings } from '../../api/settings';
import StatusTag from '../../components/StatusTag';

/**
 * 我的商品／庫存：對應「我的商品／庫存」。後端依登入身份自動篩選為自己的購買紀錄。
 * 待付款的訂單尚未入帳堂數，會員可自行取消。
 */
export default function MyProducts() {
  const queryClient = useQueryClient();
  const { data: purchases, isLoading } = useQuery({ queryKey: ['my-purchases'], queryFn: () => listPurchases() });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: listProducts });

  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  // 付款方式說明（系統設定 › 預約與付款）
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSettings });
  const unpaidCount = (purchases ?? []).filter((p) => p.payment_status === '待付款').length;

  const cancelMutation = useMutation({
    mutationFn: cancelPurchase,
    onSuccess: () => {
      message.success('已取消訂單');
      queryClient.invalidateQueries({ queryKey: ['my-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      message.error(detail || '取消失敗，請稍後再試');
    },
  });

  const columns: ColumnsType<Purchase> = [
    {
      title: '商品',
      dataIndex: 'product_id',
      render: (productId: number) => productNameById.get(productId) ?? `#${productId}`,
    },
    { title: '數量', dataIndex: 'quantity' },
    {
      title: '付款狀態',
      dataIndex: 'payment_status',
      render: (value: string) => <StatusTag status={value} />,
    },
    {
      title: '剩餘堂數',
      dataIndex: 'remaining_hours',
      render: (value: number, record) =>
        record.payment_status === '待付款' ? (
          <Typography.Text type="secondary">付款後入帳 {record.total_hours} 堂</Typography.Text>
        ) : record.total_hours > 0 ? (
          value
        ) : (
          '—'
        ),
    },
    {
      title: '購買日期',
      dataIndex: 'purchase_date',
      render: (value: string) => dayjs(value).format('YYYY-MM-DD'),
    },
    {
      title: '金額',
      dataIndex: 'amount',
      render: (amount: number) => `NT$ ${amount}`,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) =>
        record.payment_status === '待付款' ? (
          <Popconfirm title="確定要取消這筆訂單？" onConfirm={() => cancelMutation.mutate(record.id)}>
            <Button size="small" danger loading={cancelMutation.isPending && cancelMutation.variables === record.id}>
              取消訂單
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <Card>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        我的商品／庫存
      </Typography.Title>
      {unpaidCount > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`有 ${unpaidCount} 筆訂單待付款，確認收款後堂數才會入帳。`}
          description={
            <span style={{ whiteSpace: 'pre-line' }}>{settings?.payment_instructions || '請向櫃台付款。'}</span>
          }
        />
      )}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={purchases}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
}

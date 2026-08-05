import { Card, Typography, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { listPurchases, type Purchase } from '../../api/purchases';
import { listProducts } from '../../api/products';

/**
 * 我的商品／庫存：對應「我的商品／庫存」。後端依登入身份自動篩選為自己的購買紀錄。
 */
export default function MyProducts() {
  const { data: purchases, isLoading } = useQuery({ queryKey: ['my-purchases'], queryFn: () => listPurchases() });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: listProducts });

  const productNameById = new Map((products ?? []).map((p) => [p.id, p.name]));

  const columns: ColumnsType<Purchase> = [
    {
      title: '商品',
      dataIndex: 'product_id',
      render: (productId: number) => productNameById.get(productId) ?? `#${productId}`,
    },
    { title: '數量', dataIndex: 'quantity' },
    { title: '剩餘堂數', dataIndex: 'remaining_hours' },
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
  ];

  return (
    <Card>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        我的商品／庫存
      </Typography.Title>
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

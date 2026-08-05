import { Card, Typography, Table, Button, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listProducts, type Product } from '../../api/products';

/**
 * 商品管理列表：對應「商品管理列表」。後端目前僅提供 list/create/update，無刪除 API。
 */
export default function ProductList() {
  const navigate = useNavigate();

  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: listProducts });

  const columns: ColumnsType<Product> = [
    { title: '商品名稱', dataIndex: 'name' },
    { title: '分類', dataIndex: 'category' },
    { title: '堂數（小時）', dataIndex: 'session_hours' },
    {
      title: '價格',
      dataIndex: 'price',
      render: (price: number) => `NT$ ${price}`,
    },
    {
      title: '狀態',
      dataIndex: 'is_active',
      render: (isActive: boolean) => <Tag color={isActive ? 'blue' : 'default'}>{isActive ? '上架中' : '已下架'}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/admin/products/${record.id}/edit`)}>
            編輯
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          商品管理列表
        </Typography.Title>
        <Space>
          <Button onClick={() => navigate('/admin/products/purchase-entry')}>登錄購買紀錄</Button>
          <Button type="primary" onClick={() => navigate('/admin/products/new')}>
            新增商品
          </Button>
        </Space>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={products}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
}

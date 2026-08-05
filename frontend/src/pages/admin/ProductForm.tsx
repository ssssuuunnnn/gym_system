import { useEffect } from 'react';
import { Card, Typography, Form, Input, Select, InputNumber, Switch, Button, Space, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { listProducts, createProduct, updateProduct, PRODUCT_CATEGORIES, type ProductPayload } from '../../api/products';

/**
 * 建立／編輯商品。後端無 GET /products/{id}，編輯模式從既有列表快取中找出該筆資料帶入表單。
 */
export default function ProductForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const productId = id ? Number(id) : undefined;
  const [form] = Form.useForm<ProductPayload>();

  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const editingProduct = productId != null ? products?.find((p) => p.id === productId) : undefined;

  useEffect(() => {
    if (editingProduct) {
      form.setFieldsValue({
        name: editingProduct.name,
        category: editingProduct.category,
        session_hours: editingProduct.session_hours,
        price: editingProduct.price,
        is_active: editingProduct.is_active,
      });
    }
  }, [editingProduct, form]);

  const saveMutation = useMutation({
    mutationFn: (values: ProductPayload) =>
      productId != null ? updateProduct(productId, values) : createProduct(values),
    onSuccess: () => {
      message.success(productId != null ? '已更新商品' : '已建立商品');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/admin/products');
    },
    onError: (error) => {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      message.error(detail || '儲存失敗，請稍後再試');
    },
  });

  return (
    <Card loading={productId != null && isLoading}>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        {productId != null ? '編輯商品' : '新增商品'}
      </Typography.Title>
      <Form<ProductPayload>
        form={form}
        layout="vertical"
        style={{ maxWidth: 480 }}
        initialValues={{ is_active: true, session_hours: 1, price: 0 }}
        onFinish={(values) => saveMutation.mutate(values)}
      >
        <Form.Item name="name" label="商品名稱" rules={[{ required: true, message: '請輸入商品名稱' }]}>
          <Input />
        </Form.Item>

        <Form.Item name="category" label="分類" rules={[{ required: true, message: '請選擇分類' }]}>
          <Select options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))} />
        </Form.Item>

        <Form.Item
          name="session_hours"
          label="堂數（小時）"
          rules={[{ required: true, message: '請輸入堂數' }]}
        >
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="price" label="價格" rules={[{ required: true, message: '請輸入價格' }]}>
          <InputNumber min={0} style={{ width: '100%' }} addonAfter="NT$" />
        </Form.Item>

        <Form.Item name="is_active" label="上架狀態" valuePropName="checked">
          <Switch checkedChildren="上架中" unCheckedChildren="已下架" />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
              儲存
            </Button>
            <Button onClick={() => navigate('/admin/products')}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}

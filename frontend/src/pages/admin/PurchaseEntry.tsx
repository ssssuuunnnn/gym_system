import { useEffect } from 'react';
import { Card, Typography, Form, Select, InputNumber, DatePicker, Button, Space, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { isAxiosError } from 'axios';
import { createPurchase } from '../../api/purchases';
import { listMembers } from '../../api/users';
import { listProducts } from '../../api/products';

interface FormValues {
  user_id: number;
  product_id: number;
  quantity: number;
  purchase_date: Dayjs;
  amount: number;
}

/**
 * 購買紀錄登錄：對應「購買紀錄登錄」。選會員、選商品、數量、購買日期、金額。
 * 課程商品的 remaining_hours 由後端依 session_hours * quantity 自動計算；用品則由後端扣減庫存，此頁不重複計算。
 * 送出後清空表單留在原頁，方便櫃檯連續登錄多筆購買。
 */
export default function PurchaseEntry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<FormValues>();
  const productId = Form.useWatch('product_id', form);
  const quantity = Form.useWatch('quantity', form);

  const { data: members, isLoading: membersLoading } = useQuery({ queryKey: ['members'], queryFn: listMembers });
  const { data: products, isLoading: productsLoading } = useQuery({ queryKey: ['products'], queryFn: listProducts });

  const selectedProduct = products?.find((p) => p.id === productId);

  useEffect(() => {
    if (selectedProduct && quantity) {
      form.setFieldValue('amount', selectedProduct.price * quantity);
    }
  }, [selectedProduct, quantity, form]);

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      createPurchase({
        user_id: values.user_id,
        product_id: values.product_id,
        quantity: values.quantity,
        purchase_date: values.purchase_date.format('YYYY-MM-DD'),
        amount: values.amount,
      }),
    onSuccess: () => {
      message.success('已登錄購買紀錄');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      form.resetFields();
    },
    onError: (error) => {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      message.error(detail || '登錄失敗，請稍後再試');
    },
  });

  return (
    <Card>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        購買紀錄登錄
      </Typography.Title>
      <Form<FormValues>
        form={form}
        layout="vertical"
        style={{ maxWidth: 480 }}
        initialValues={{ quantity: 1, purchase_date: dayjs() }}
        onFinish={(values) => createMutation.mutate(values)}
      >
        <Form.Item name="user_id" label="會員" rules={[{ required: true, message: '請選擇會員' }]}>
          <Select
            loading={membersLoading}
            showSearch
            optionFilterProp="label"
            placeholder="選擇會員"
            options={(members ?? []).map((m) => ({ value: m.id, label: m.username }))}
          />
        </Form.Item>

        <Form.Item name="product_id" label="商品" rules={[{ required: true, message: '請選擇商品' }]}>
          <Select
            loading={productsLoading}
            showSearch
            optionFilterProp="label"
            placeholder="選擇商品"
            options={(products ?? []).map((p) => ({
              value: p.id,
              label:
                p.category === '用品'
                  ? `${p.name}（用品｜庫存 ${p.stock ?? 0}｜NT$${p.price}）`
                  : `${p.name}（團體課程｜${p.session_hours}堂｜NT$${p.price}）`,
              disabled: p.category === '用品' && (p.stock ?? 0) <= 0,
            }))}
          />
        </Form.Item>

        <Form.Item name="quantity" label="數量" rules={[{ required: true, message: '請輸入數量' }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="purchase_date" label="購買日期" rules={[{ required: true, message: '請選擇日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="amount"
          label="金額"
          rules={[{ required: true, message: '請輸入金額' }]}
          extra={selectedProduct ? '已依商品單價 × 數量帶入，可手動調整' : undefined}
        >
          <InputNumber min={0} style={{ width: '100%' }} addonAfter="NT$" />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
              登錄
            </Button>
            <Button onClick={() => navigate('/admin/products')}>回商品列表</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}

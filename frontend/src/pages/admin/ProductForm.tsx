import { useEffect } from 'react';
import { Card, Typography, Form, Input, Select, InputNumber, Switch, Button, Space, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { listProducts, createProduct, updateProduct, PRODUCT_CATEGORIES, type ProductPayload } from '../../api/products';
import { listActiveCourses } from '../../api/courses';
import { listCoaches } from '../../api/coaches';

interface FormValues {
  name: string;
  category: ProductPayload['category'];
  course_id?: number;
  stock?: number;
  price: number;
  is_active: boolean;
}

/**
 * 建立／編輯商品。分類分為「課程」與「用品」：
 * - 課程：綁定團體課程，堂數沿用該課程的課堂數（唯讀）。
 * - 用品：輸入庫存數量（登錄購買時扣減）。
 * 後端無 GET /products/{id}，編輯模式從既有列表快取中找出該筆資料帶入表單。
 */
export default function ProductForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const productId = id ? Number(id) : undefined;
  const [form] = Form.useForm<FormValues>();
  const category = Form.useWatch('category', form);
  const courseId = Form.useWatch('course_id', form);

  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const { data: courses } = useQuery({ queryKey: ['courses', 'active'], queryFn: listActiveCourses });
  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });

  const coachNameById = new Map((coaches ?? []).map((c) => [c.id, c.name]));
  const selectedCourse = courses?.find((c) => c.id === courseId);

  const editingProduct = productId != null ? products?.find((p) => p.id === productId) : undefined;

  // 只能綁定「上架」課程；編輯既有商品時，若原綁課程已非上架仍保留該選項，避免靜默清掉已選值。
  const courseOptions = (courses ?? []).filter(
    (c) => c.status === '上架' || c.id === editingProduct?.course_id,
  );

  useEffect(() => {
    if (editingProduct) {
      form.setFieldsValue({
        name: editingProduct.name,
        category: editingProduct.category,
        course_id: editingProduct.course_id ?? undefined,
        stock: editingProduct.stock ?? undefined,
        price: editingProduct.price,
        is_active: editingProduct.is_active,
      });
    }
  }, [editingProduct, form]);

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: ProductPayload = {
        name: values.name,
        category: values.category,
        price: values.price,
        is_active: values.is_active,
        course_id: values.category === '團體課程' ? values.course_id : null,
        stock: values.category === '用品' ? values.stock : null,
      };
      return productId != null ? updateProduct(productId, payload) : createProduct(payload);
    },
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
      <Form<FormValues>
        form={form}
        layout="vertical"
        style={{ maxWidth: 480 }}
        initialValues={{ is_active: true, price: 0 }}
        onFinish={(values) => saveMutation.mutate(values)}
      >
        <Form.Item name="name" label="商品名稱" rules={[{ required: true, message: '請輸入商品名稱' }]}>
          <Input />
        </Form.Item>

        <Form.Item name="category" label="分類" rules={[{ required: true, message: '請選擇分類' }]}>
          <Select
            options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))}
            onChange={() => {
              form.setFieldsValue({ course_id: undefined, stock: undefined });
            }}
          />
        </Form.Item>

        {category === '團體課程' && (
          <>
            <Form.Item name="course_id" label="團體課程" rules={[{ required: true, message: '請選擇團體課程' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="選擇上架中的團體課程"
                options={courseOptions.map((c) => ({
                  value: c.id,
                  label: `${c.name}（${coachNameById.get(c.coach_id) ?? '未指定教練'}｜${c.status}）`,
                }))}
              />
            </Form.Item>
            <Form.Item label="堂數（小時）">
              <Typography.Text>
                {selectedCourse ? `${selectedCourse.session_count} 堂（沿用所選課程的課堂數）` : '請先選擇課程'}
              </Typography.Text>
            </Form.Item>
          </>
        )}

        {category === '用品' && (
          <Form.Item name="stock" label="數量（庫存）" rules={[{ required: true, message: '請輸入庫存數量' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        )}

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

import { useEffect, useState } from 'react';
import { Card, Typography, Form, Select, InputNumber, DatePicker, Button, Space, Input, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { isAxiosError } from 'axios';
import { createPurchase, PAYMENT_METHODS, type PaymentMethod } from '../../api/purchases';
import { listUsableCoupons, quoteCoupon } from '../../api/coupons';
import { apiErrorMessage } from '../../api/errors';
import { listMembers } from '../../api/users';
import { listProducts } from '../../api/products';

interface FormValues {
  user_id: number;
  product_id: number;
  quantity: number;
  purchase_date: Dayjs;
  amount: number;
  payment_method: PaymentMethod;
  payment_note?: string;
  /** 會員手上的折價券（ADR 0010） */
  member_coupon_id?: number;
}

/**
 * 購買紀錄登錄：對應「購買紀錄登錄」。選會員、選商品、數量、購買日期、金額。
 * 課程商品的 remaining_hours 由後端依 session_hours * quantity 自動計算；用品則由後端扣減庫存，此頁不重複計算。
 * 此頁登錄代表已收款：建立即為「已付款」並立即入帳堂數（會員自助購買才會是待付款）。
 * 送出後清空表單留在原頁，方便櫃檯連續登錄多筆購買。
 */
export default function PurchaseEntry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<FormValues>();
  const productId = Form.useWatch('product_id', form);
  const quantity = Form.useWatch('quantity', form);
  const userId = Form.useWatch('user_id', form);
  const memberCouponId = Form.useWatch('member_coupon_id', form);
  // 會員現場出示的公開代碼（按「套用」才試算）
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState<string | null>(null);

  const { data: members, isLoading: membersLoading } = useQuery({ queryKey: ['members'], queryFn: listMembers });
  const { data: products, isLoading: productsLoading } = useQuery({ queryKey: ['products'], queryFn: listProducts });

  const selectedProduct = products?.find((p) => p.id === productId);
  const ready = !!userId && !!productId && !!quantity;

  // 優惠券：會員手上可用的折價券，以及選了券／代碼之後由伺服器試算的金額
  const { data: usable = [] } = useQuery({
    queryKey: ['coupons-usable', userId, productId, quantity],
    queryFn: () => listUsableCoupons(productId, quantity, userId),
    enabled: ready,
  });
  const couponChosen = !!memberCouponId || !!code;
  const quote = useQuery({
    queryKey: ['coupon-quote', userId, productId, quantity, memberCouponId ?? null, code],
    queryFn: () =>
      quoteCoupon({ product_id: productId, quantity, user_id: userId, member_coupon_id: memberCouponId ?? null, code }),
    enabled: ready && couponChosen,
    retry: false,
  });
  const quoted = couponChosen && quote.data ? quote.data : null;

  useEffect(() => {
    if (quoted) {
      form.setFieldValue('amount', quoted.final);
    } else if (selectedProduct && quantity) {
      form.setFieldValue('amount', selectedProduct.price * quantity);
    }
  }, [selectedProduct, quantity, quoted, form]);

  // 換會員就清掉券
  useEffect(() => {
    form.setFieldValue('member_coupon_id', undefined);
    setCode(null);
    setCodeInput('');
  }, [userId, form]);

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      createPurchase({
        user_id: values.user_id,
        product_id: values.product_id,
        quantity: values.quantity,
        purchase_date: values.purchase_date.format('YYYY-MM-DD'),
        amount: values.amount,
        payment_method: values.payment_method,
        payment_note: values.payment_note || null,
        member_coupon_id: values.member_coupon_id ?? null,
        coupon_code: values.member_coupon_id ? null : code,
      }),
    onSuccess: () => {
      message.success('已登錄購買紀錄');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['coupons-usable'] });
      form.resetFields();
      setCode(null);
      setCodeInput('');
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
                  : `${p.name}（${p.category}｜${p.session_hours}堂｜NT$${p.price}）`,
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
          name="member_coupon_id"
          label="優惠券（選填）"
          extra={ready && !usable.length ? '這位會員沒有可用的折價券' : undefined}
        >
          <Select
            allowClear
            disabled={!ready || !!code}
            placeholder={ready ? '不使用' : '先選會員、商品與數量'}
            options={usable.map((u) => ({
              value: u.member_coupon.id,
              disabled: !u.usable,
              label: u.usable
                ? `${u.member_coupon.name}（折 NT$${u.discount.toLocaleString()}）`
                : `${u.member_coupon.name}（${u.reason}）`,
            }))}
          />
        </Form.Item>

        <Form.Item
          label="或輸入優惠代碼"
          validateStatus={code && quote.isError ? 'error' : undefined}
          help={code && quote.isError ? apiErrorMessage(quote.error) : undefined}
        >
          <Space.Compact style={{ width: '100%' }}>
            <Input
              value={codeInput}
              disabled={!ready || !!memberCouponId}
              placeholder="例如 WELCOME300"
              onChange={(e) => {
                setCodeInput(e.target.value);
                if (!e.target.value) setCode(null);
              }}
            />
            <Button disabled={!ready || !!memberCouponId || !codeInput.trim()} onClick={() => setCode(codeInput.trim())}>
              套用
            </Button>
          </Space.Compact>
        </Form.Item>

        <Form.Item
          name="amount"
          label="金額"
          rules={[{ required: true, message: '請輸入金額' }]}
          extra={
            quoted
              ? `已套用「${quoted.coupon_name}」：原價 NT$${quoted.original.toLocaleString()}，折抵 NT$${quoted.discount.toLocaleString()}（金額由系統計算）`
              : selectedProduct
                ? '已依商品單價 × 數量帶入，可手動調整'
                : undefined
          }
        >
          <InputNumber min={0} style={{ width: '100%' }} addonAfter="NT$" disabled={!!quoted} />
        </Form.Item>

        <Form.Item
          name="payment_method"
          label="付款方式"
          rules={[{ required: true, message: '請選擇付款方式' }]}
          extra="登錄即視為已收款，堂數會立即入帳"
        >
          <Select placeholder="選擇付款方式" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
        </Form.Item>

        <Form.Item name="payment_note" label="收款備註（選填）">
          <Input maxLength={255} placeholder="例如：轉帳末五碼 12345" />
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

import { useEffect } from 'react';
import { Alert, DatePicker, Flex, Form, Input, InputNumber, Modal, Radio, Select, Switch, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { Coupon, CouponInput, CouponKind, DiscountType } from '../../../../api/coupons';
import type { Product } from '../../../../api/products';
import { percentOffToRate, rateToPercentOff } from '../lib';

interface FormValues {
  kind: CouponKind;
  name: string;
  description?: string;
  code?: string;
  discount_type: DiscountType;
  amount_off?: number;
  /** 幾折（8.5） */
  rate?: number;
  min_amount?: number;
  product_ids: number[];
  trial_product_id?: number;
  counts_for_payout: boolean;
  issue_on_line_join: boolean;
  period?: [Dayjs | null, Dayjs | null] | null;
  valid_days?: number | null;
  total_limit?: number | null;
  per_member_limit: number;
  new_member_only: boolean;
  is_active: boolean;
}

export interface CouponFormModalProps {
  open: boolean;
  /** 編輯中的券；null＝新增 */
  editing: Coupon | null;
  products: Product[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: CouponInput) => void;
}

const DATE = 'YYYY-MM-DD';

/** 新增／編輯優惠券。已經發出去的券不能改類型、折扣與送的方案（後端也會擋）。 */
export function CouponFormModal({ open, editing, products, saving, onCancel, onSubmit }: CouponFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const kind = Form.useWatch('kind', form);
  const discountType = Form.useWatch('discount_type', form);
  const locked = !!editing && editing.issued_count > 0;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (!editing) return;
    form.setFieldsValue({
      kind: editing.kind,
      name: editing.name,
      description: editing.description ?? undefined,
      code: editing.code ?? undefined,
      discount_type: editing.discount_type ?? '折抵金額',
      amount_off: editing.discount_type === '折抵金額' ? (editing.discount_value ?? undefined) : undefined,
      rate: editing.discount_type === '折扣' && editing.discount_value ? percentOffToRate(editing.discount_value) : undefined,
      min_amount: editing.min_amount || undefined,
      product_ids: editing.product_ids,
      trial_product_id: editing.trial_product_id ?? undefined,
      counts_for_payout: editing.counts_for_payout,
      issue_on_line_join: editing.issue_on_line_join,
      period:
        editing.valid_from || editing.valid_until
          ? [editing.valid_from ? dayjs(editing.valid_from) : null, editing.valid_until ? dayjs(editing.valid_until) : null]
          : null,
      valid_days: editing.valid_days,
      total_limit: editing.total_limit,
      per_member_limit: editing.per_member_limit,
      new_member_only: editing.new_member_only,
      is_active: editing.is_active,
    });
  }, [open, editing, form]);

  const courseProducts = products.filter((p) => p.category !== '用品');
  const productOption = (p: Product) => ({
    value: p.id,
    label: `${p.name}（${p.session_hours} 堂・NT$${p.price.toLocaleString()}${p.is_active ? '' : '・未上架'}）`,
  });

  const submit = (v: FormValues) => {
    const [from, until] = v.period ?? [null, null];
    const discount = v.kind === '折價券';
    onSubmit({
      name: v.name.trim(),
      kind: v.kind,
      description: v.description?.trim() || null,
      code: v.code?.trim() || null,
      discount_type: discount ? v.discount_type : null,
      discount_value: discount ? (v.discount_type === '折扣' ? rateToPercentOff(v.rate ?? 10) : (v.amount_off ?? null)) : null,
      min_amount: discount ? (v.min_amount ?? 0) : 0,
      product_ids: discount ? v.product_ids : [],
      trial_product_id: discount ? null : (v.trial_product_id ?? null),
      counts_for_payout: discount ? true : v.counts_for_payout,
      issue_on_line_join: discount ? false : v.issue_on_line_join,
      valid_from: from ? from.format(DATE) : null,
      valid_until: until ? until.format(DATE) : null,
      valid_days: v.valid_days ?? null,
      total_limit: v.total_limit ?? null,
      per_member_limit: v.per_member_limit,
      new_member_only: v.new_member_only,
      is_active: v.is_active,
    });
  };

  return (
    <Modal
      open={open}
      title={editing ? `編輯「${editing.name}」` : '新增優惠券'}
      okText={editing ? '儲存' : '建立'}
      cancelText="取消"
      confirmLoading={saving}
      onCancel={onCancel}
      onOk={() => form.submit()}
      width={640}
      destroyOnHidden
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={submit}
        initialValues={{
          kind: '折價券',
          discount_type: '折抵金額',
          product_ids: [],
          counts_for_payout: true,
          issue_on_line_join: false,
          per_member_limit: 1,
          new_member_only: false,
          is_active: true,
        }}
      >
        {locked && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title="這張券已經發出去了"
            description="類型、折扣內容與送的方案不能再改；要改請停用後另建一張。名稱、期限、張數等其他設定可以修改。"
          />
        )}
        <Form.Item name="kind" label="類型">
          <Radio.Group disabled={!!editing} optionType="button" buttonStyle="solid" options={['折價券', '體驗券']} />
        </Form.Item>
        <Form.Item name="name" label="名稱" rules={[{ required: true, whitespace: true, message: '請輸入名稱' }]}>
          <Input maxLength={60} placeholder={kind === '體驗券' ? '例如：免費體驗一堂' : '例如：新會員折 300'} />
        </Form.Item>
        <Form.Item name="description" label="給會員看的說明（選填）">
          <Input.TextArea maxLength={200} autoSize={{ minRows: 1, maxRows: 3 }} placeholder="例如：限新會員，平日晚上可用" />
        </Form.Item>

        {kind === '體驗券' ? (
          <>
            <Form.Item
              name="trial_product_id"
              label="送哪個方案"
              rules={[{ required: true, message: '請選擇方案' }]}
              extra="會員使用時送這個方案的堂數（數量 1）。可以選沒有上架販售的「體驗課」方案。"
            >
              <Select disabled={locked} placeholder="選擇方案" options={courseProducts.map(productOption)} showSearch optionFilterProp="label" />
            </Form.Item>
            <Flex gap={32} wrap>
              <Form.Item name="counts_for_payout" label="計教練鐘點" valuePropName="checked" extra="關閉＝用這張券上的課不付教練鐘點">
                <Switch />
              </Form.Item>
              <Form.Item name="issue_on_line_join" label="LINE 新加入自動發" valuePropName="checked" extra="會員從 LINE 加入時自動送這張">
                <Switch />
              </Form.Item>
            </Flex>
          </>
        ) : (
          <>
            <Flex gap={16} wrap align="flex-start">
              <Form.Item name="discount_type" label="折扣方式">
                <Radio.Group disabled={locked} options={['折抵金額', '折扣']} />
              </Form.Item>
              {discountType === '折扣' ? (
                <Form.Item name="rate" label="打幾折" rules={[{ required: true, message: '請輸入折數' }]} style={{ width: 160 }}>
                  <InputNumber disabled={locked} min={1} max={9.9} step={0.5} precision={1} suffix="折" style={{ width: '100%' }} placeholder="8.5" />
                </Form.Item>
              ) : (
                <Form.Item name="amount_off" label="折抵金額" rules={[{ required: true, message: '請輸入金額' }]} style={{ width: 180 }}>
                  <InputNumber disabled={locked} min={1} precision={0} prefix="NT$" style={{ width: '100%' }} placeholder="300" />
                </Form.Item>
              )}
              <Form.Item name="min_amount" label="最低消費（選填）" style={{ width: 180 }}>
                <InputNumber min={0} precision={0} prefix="NT$" style={{ width: '100%' }} placeholder="不限" />
              </Form.Item>
            </Flex>
            <Form.Item name="product_ids" label="適用方案" extra="不選＝全部方案都可以用">
              <Select mode="multiple" allowClear placeholder="全部方案" options={products.map(productOption)} optionFilterProp="label" />
            </Form.Item>
          </>
        )}

        <Form.Item
          name="code"
          label="公開代碼（選填）"
          extra="有代碼：貼在 IG、LINE、傳單，會員輸入代碼就能領。沒有代碼：只能由後台發給指定會員。"
        >
          <Input maxLength={30} placeholder="例如 WELCOME300（英文字母和數字）" style={{ textTransform: 'uppercase' }} />
        </Form.Item>

        <Flex gap={16} wrap>
          <Form.Item name="period" label="可使用期間（選填）" style={{ minWidth: 260 }}>
            <DatePicker.RangePicker allowEmpty={[true, true]} placeholder={['即日起', '不限']} />
          </Form.Item>
          <Form.Item name="valid_days" label="發出後幾天內有效（選填）" style={{ width: 200 }}>
            <InputNumber min={1} max={3650} precision={0} suffix="天" style={{ width: '100%' }} placeholder="不限" />
          </Form.Item>
        </Flex>
        <Flex gap={16} wrap align="flex-start">
          <Form.Item name="total_limit" label="總共可發幾張（選填）" style={{ width: 180 }}>
            <InputNumber min={1} precision={0} suffix="張" style={{ width: '100%' }} placeholder="不限" />
          </Form.Item>
          <Form.Item name="per_member_limit" label="每人幾張" style={{ width: 140 }} rules={[{ required: true }]}>
            <InputNumber min={1} max={100} precision={0} suffix="張" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="new_member_only" label="新會員限定" valuePropName="checked" extra="沒有付費購買紀錄的會員">
            <Switch />
          </Form.Item>
          <Form.Item name="is_active" label="啟用" valuePropName="checked" extra="停用後不能再發或領，已發出的仍可用">
            <Switch />
          </Form.Item>
        </Flex>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          一張訂單只能用一張券；折抵金額由系統計算，會員看到的就是實際應付金額。
        </Typography.Text>
      </Form>
    </Modal>
  );
}

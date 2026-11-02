import { useEffect } from 'react';
import { DatePicker, Form, Input, InputNumber, Modal, Radio, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import {
  ENTRY_KINDS,
  ENTRY_PAYMENT_METHODS,
  type AccountingCategory,
  type AccountingEntry,
  type EntryKind,
  type EntryPayload,
} from '../../../../api/accounting';
import type { PaymentMethod } from '../../../../api/purchases';
import type { Branch } from '../../../../api/branches';

export interface EntryFormModalProps {
  open: boolean;
  /** 修改哪一筆；null＝新增 */
  entry: AccountingEntry | null;
  categories: AccountingCategory[];
  branches: Branch[];
  /** 新增時預設的分店（報表目前選的分店） */
  defaultBranchId: number | null;
  saving: boolean;
  onSubmit: (payload: EntryPayload) => void;
  onCancel: () => void;
}

interface FormValues {
  kind: EntryKind;
  category_id: number;
  entry_date: Dayjs;
  amount: number;
  payment_method: PaymentMethod;
  /** 0＝全店共同（Select 不接受 null 當選項值） */
  branch_id: number;
  note?: string;
}

const SHARED = 0;

/** 新增／修改手動帳目（R59）：收入或支出、分類、日期、金額、付款方式、分店（可全店共同）、備註 */
export function EntryFormModal({
  open,
  entry,
  categories,
  branches,
  defaultBranchId,
  saving,
  onSubmit,
  onCancel,
}: EntryFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const kind = Form.useWatch('kind', form);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(
      entry
        ? {
            kind: entry.kind,
            category_id: entry.category_id,
            entry_date: dayjs(entry.entry_date),
            amount: entry.amount,
            payment_method: entry.payment_method,
            branch_id: entry.branch_id ?? SHARED,
            note: entry.note ?? undefined,
          }
        : {
            kind: '支出',
            category_id: undefined,
            entry_date: dayjs(),
            amount: undefined,
            payment_method: '轉帳',
            branch_id: defaultBranchId ?? SHARED,
            note: undefined,
          },
    );
  }, [open, entry, defaultBranchId, form]);

  // 停用的分類不能選，但修改舊帳目時保留它原本的分類
  const categoryOptions = categories
    .filter((c) => c.kind === kind && (c.is_active || c.id === entry?.category_id))
    .map((c) => ({ value: c.id, label: c.is_active ? c.name : `${c.name}（已停用）` }));

  const branchOptions = [
    { value: SHARED, label: '全店共同（不屬於任何分店）' },
    ...branches.map((b) => ({ value: b.id, label: b.is_active ? b.name : `${b.name}（停用）` })),
  ];

  return (
    <Modal
      title={entry ? '修改帳目' : '新增帳目'}
      open={open}
      okText="儲存"
      onOk={() => form.submit()}
      onCancel={onCancel}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={(v) =>
          onSubmit({
            kind: v.kind,
            category_id: v.category_id,
            entry_date: v.entry_date.format('YYYY-MM-DD'),
            amount: v.amount,
            payment_method: v.payment_method,
            branch_id: v.branch_id === SHARED ? null : v.branch_id,
            note: v.note?.trim() || null,
          })
        }
      >
        <Form.Item name="kind" label="收支">
          <Radio.Group
            optionType="button"
            options={ENTRY_KINDS}
            onChange={() => form.setFieldValue('category_id', undefined)}
          />
        </Form.Item>
        <Form.Item name="category_id" label="分類" rules={[{ required: true, message: '請選擇分類' }]}>
          <Select options={categoryOptions} placeholder="選擇分類" />
        </Form.Item>
        <Form.Item name="entry_date" label="日期" rules={[{ required: true, message: '請選擇日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="amount" label="金額" rules={[{ required: true, message: '請輸入金額' }]}>
          <InputNumber min={1} max={99999999} precision={0} prefix="NT$" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="payment_method" label="付款方式" rules={[{ required: true }]}>
          <Radio.Group optionType="button" options={ENTRY_PAYMENT_METHODS} />
        </Form.Item>
        <Form.Item name="branch_id" label="分店">
          <Select options={branchOptions} />
        </Form.Item>
        <Form.Item name="note" label="備註（選填）">
          <Input maxLength={200} showCount placeholder="例如：一月房租、冷氣維修" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

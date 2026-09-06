import { useEffect } from 'react';
import { Modal, Form, DatePicker, Select, InputNumber, Input, message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { isAxiosError } from 'axios';
import { updateReservation, type Reservation } from '../../../../api/reservations';

const HOURS = Array.from({ length: 12 }, (_, i) => 10 + i); // 10:00–21:00

interface FormValues {
  booking_date: Dayjs;
  start_hour: number;
  people_count: number;
  notes?: string;
}

interface EditBookingModalProps {
  /** 要編輯的預約，null 表示關閉。僅待確認狀態的預約可編輯（後端同步檢查）。 */
  reservation: Reservation | null;
  onClose: () => void;
}

/**
 * 我的預約：編輯待確認中的預約。僅開放日期／時段／人數／備註 —— 變更商品／教練／課程
 * 視同重新預約，不在編輯範圍內。
 */
export default function EditBookingModal({ reservation, onClose }: EditBookingModalProps) {
  const [form] = Form.useForm<FormValues>();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (reservation) {
      form.setFieldsValue({
        booking_date: dayjs(reservation.booking_date),
        start_hour: reservation.start_hour,
        people_count: reservation.people_count,
        notes: reservation.notes ?? undefined,
      });
    }
  }, [reservation, form]);

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateReservation(reservation!.id, {
        booking_date: values.booking_date.format('YYYY-MM-DD'),
        start_hour: values.start_hour,
        people_count: values.people_count,
        notes: values.notes || null,
      }),
    onSuccess: () => {
      message.success('已更新預約');
      queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
      onClose();
    },
    onError: (error) => {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      message.error(detail || '更新失敗，請稍後再試');
    },
  });

  return (
    <Modal
      title="編輯預約"
      open={!!reservation}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={updateMutation.isPending}
      destroyOnHidden
    >
      <Form<FormValues> form={form} layout="vertical" onFinish={(values) => updateMutation.mutate(values)}>
        <Form.Item name="booking_date" label="預約日期" rules={[{ required: true, message: '請選擇日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="start_hour" label="時段" rules={[{ required: true, message: '請選擇時段' }]}>
          <Select options={HOURS.map((h) => ({ value: h, label: `${h}:00` }))} />
        </Form.Item>
        <Form.Item name="people_count" label="人數" rules={[{ required: true, message: '請輸入人數' }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="notes" label="備註（選填）">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

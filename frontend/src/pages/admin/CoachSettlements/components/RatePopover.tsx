import { useEffect, useState } from 'react';
import { Button, Form, InputNumber, Popover, Space, message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EditOutlined } from '@ant-design/icons';
import { updateSettlementRates, type SettlementRates } from '../../../../api/settlements';

interface RatePopoverProps {
  rates: SettlementRates;
}

/** 「依課程類型鐘點費」的行內編輯：小型 Popover，儲存後刷新結算查詢。 */
export default function RatePopover({ rates }: RatePopoverProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        group_course_rate: Number(rates.group_course_rate),
        private_rate: Number(rates.private_rate),
        venue_rental_rate: Number(rates.venue_rental_rate),
      });
    }
  }, [open, rates, form]);

  const mutation = useMutation({
    mutationFn: updateSettlementRates,
    onSuccess: () => {
      message.success('鐘點費設定已更新');
      queryClient.invalidateQueries({ queryKey: ['coach-settlement-rates'] });
      queryClient.invalidateQueries({ queryKey: ['coach-settlement'] });
      setOpen(false);
    },
    onError: () => {
      message.error('鐘點費設定更新失敗，請稍後再試');
    },
  });

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      title="依課程類型鐘點費"
      content={
        <Form form={form} layout="vertical" style={{ width: 200 }} onFinish={(v) => mutation.mutate(v)}>
          <Form.Item label="團體課程 (NT$/堂)" name="group_course_rate" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="一對一 (NT$/堂)" name="private_rate" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="場租 (NT$/堂)" name="venue_rental_rate" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button size="small" type="primary" htmlType="submit" loading={mutation.isPending}>
              儲存
            </Button>
          </Space>
        </Form>
      }
    >
      <Button type="link" size="small" icon={<EditOutlined />} style={{ padding: 0 }}>
        編輯鐘點費
      </Button>
    </Popover>
  );
}

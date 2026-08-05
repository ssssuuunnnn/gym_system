import { Card, Typography, Form, Select, DatePicker, InputNumber, Input, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { isAxiosError } from 'axios';
import { createReservation } from '../../api/reservations';
import { listMembers } from '../../api/users';
import { listProducts } from '../../api/products';
import { listCoaches } from '../../api/coaches';
import { listCourses } from '../../api/courses';
import { listPurchases } from '../../api/purchases';

const HOURS = Array.from({ length: 12 }, (_, i) => 10 + i); // 10:00–21:00

interface FormValues {
  member_id: number;
  product_id: number;
  coach_id?: number;
  course_id?: number;
  purchase_id?: number;
  booking_date: Dayjs;
  start_hour: number;
  people_count: number;
  notes?: string;
}

/**
 * 管理員建立預約：對應「管理員建立預約」。以 as_admin=true 呼叫 POST /reservations，
 * 建立後直接是「已確認」狀態（無需審核），後端會做時段開放與容量檢查。
 */
export default function CreateBooking() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<FormValues>();
  const memberId = Form.useWatch('member_id', form);

  const { data: members, isLoading: membersLoading } = useQuery({ queryKey: ['members'], queryFn: listMembers });
  const { data: products, isLoading: productsLoading } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const { data: coaches, isLoading: coachesLoading } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const { data: courses, isLoading: coursesLoading } = useQuery({ queryKey: ['courses'], queryFn: listCourses });
  const { data: memberPurchases } = useQuery({
    queryKey: ['purchases', memberId],
    queryFn: () => listPurchases(memberId),
    enabled: memberId != null,
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      createReservation(
        {
          member_id: values.member_id,
          product_id: values.product_id,
          coach_id: values.coach_id ?? null,
          course_id: values.course_id ?? null,
          purchase_id: values.purchase_id ?? null,
          booking_date: values.booking_date.format('YYYY-MM-DD'),
          start_hour: values.start_hour,
          people_count: values.people_count,
          notes: values.notes || null,
        },
        true,
      ),
    onSuccess: () => {
      message.success('已建立預約');
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      navigate('/admin/reservations');
    },
    onError: (error) => {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      message.error(detail || '建立失敗，請稍後再試');
    },
  });

  return (
    <Card>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        管理員建立預約
      </Typography.Title>
      <Form<FormValues>
        form={form}
        layout="vertical"
        style={{ maxWidth: 480 }}
        initialValues={{ people_count: 1 }}
        onFinish={(values) => createMutation.mutate(values)}
      >
        <Form.Item name="member_id" label="會員" rules={[{ required: true, message: '請選擇會員' }]}>
          <Select
            loading={membersLoading}
            showSearch
            optionFilterProp="label"
            placeholder="選擇會員"
            options={(members ?? []).map((m) => ({ value: m.id, label: m.username }))}
            onChange={() => form.setFieldValue('purchase_id', undefined)}
          />
        </Form.Item>

        <Form.Item name="product_id" label="商品" rules={[{ required: true, message: '請選擇商品' }]}>
          <Select
            loading={productsLoading}
            showSearch
            optionFilterProp="label"
            placeholder="選擇商品"
            options={(products ?? []).map((p) => ({ value: p.id, label: `${p.name}（${p.category}）` }))}
          />
        </Form.Item>

        <Form.Item name="coach_id" label="教練（選填）">
          <Select
            allowClear
            loading={coachesLoading}
            showSearch
            optionFilterProp="label"
            placeholder="選擇教練"
            options={(coaches ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>

        <Form.Item name="course_id" label="課程（選填）">
          <Select
            allowClear
            loading={coursesLoading}
            showSearch
            optionFilterProp="label"
            placeholder="選擇課程"
            options={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>

        <Form.Item name="purchase_id" label="關聯購買紀錄（選填）">
          <Select
            allowClear
            disabled={!memberId}
            placeholder={memberId ? '選擇購買紀錄' : '請先選擇會員'}
            options={(memberPurchases ?? []).map((p) => ({
              value: p.id,
              label: `#${p.id}｜剩餘 ${p.remaining_hours} 堂｜${p.purchase_date}`,
            }))}
          />
        </Form.Item>

        <Form.Item name="booking_date" label="預約日期" rules={[{ required: true, message: '請選擇日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="start_hour" label="時段" rules={[{ required: true, message: '請選擇時段' }]}>
          <Select
            placeholder="選擇時段"
            options={HOURS.map((h) => ({ value: h, label: `${h}:00` }))}
          />
        </Form.Item>

        <Form.Item name="people_count" label="人數" rules={[{ required: true, message: '請輸入人數' }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="notes" label="備註（選填）">
          <Input.TextArea rows={3} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
            建立預約
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

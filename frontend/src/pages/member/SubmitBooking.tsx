import { Card, Typography, Form, Select, DatePicker, InputNumber, Input, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { isAxiosError } from 'axios';
import { createReservation } from '../../api/reservations';
import { listProducts, type ProductCategory } from '../../api/products';
import { listCoaches } from '../../api/coaches';
import { listCourses } from '../../api/courses';
import { listPurchases } from '../../api/purchases';
import { useAuthStore, decodeUserId } from '../../store/auth';

const HOURS = Array.from({ length: 12 }, (_, i) => 10 + i); // 10:00–21:00

// 場租1對1／包場屬於教練租用場地的商品類型，僅場租教練身份顯示；臨時加人僅能透過「加購」流程使用，不列入可直接預約的商品。
const COACH_ONLY_CATEGORIES: ProductCategory[] = ['場租1對1', '包場'];
const ADDON_ONLY_CATEGORIES: ProductCategory[] = ['臨時加人'];

interface FormValues {
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
 * 送出預約申請：對應「送出預約申請」。以 as_admin=false 呼叫 POST /reservations，
 * 建立後狀態為「待確認」，須等待管理員審核。member_id 由後端依登入者自動帶入
 * （非管理員送出申請一律歸屬自己），前端不需也不能指定他人。
 */
export default function SubmitBooking() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<FormValues>();
  const { token, isCoach } = useAuthStore();
  const selfId = decodeUserId(token);

  const { data: products, isLoading: productsLoading } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const { data: coaches, isLoading: coachesLoading } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const { data: courses, isLoading: coursesLoading } = useQuery({ queryKey: ['courses'], queryFn: listCourses });
  const { data: purchases } = useQuery({ queryKey: ['my-purchases'], queryFn: () => listPurchases() });

  const availableProducts = (products ?? []).filter((p) => {
    if (ADDON_ONLY_CATEGORIES.includes(p.category)) return false;
    if (!isCoach && COACH_ONLY_CATEGORIES.includes(p.category)) return false;
    return p.is_active;
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      createReservation(
        {
          member_id: selfId ?? 0,
          product_id: values.product_id,
          coach_id: values.coach_id ?? null,
          course_id: values.course_id ?? null,
          purchase_id: values.purchase_id ?? null,
          booking_date: values.booking_date.format('YYYY-MM-DD'),
          start_hour: values.start_hour,
          people_count: values.people_count,
          notes: values.notes || null,
        },
        false,
      ),
    onSuccess: () => {
      message.success('已送出預約申請，請等待管理員審核');
      queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
      navigate('/member/bookings');
    },
    onError: (error) => {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      message.error(detail || '送出失敗，請稍後再試');
    },
  });

  return (
    <Card>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        送出預約申請
      </Typography.Title>
      <Form<FormValues>
        form={form}
        layout="vertical"
        style={{ maxWidth: 480 }}
        initialValues={{ people_count: 1 }}
        onFinish={(values) => createMutation.mutate(values)}
      >
        <Form.Item name="product_id" label="商品" rules={[{ required: true, message: '請選擇商品' }]}>
          <Select
            loading={productsLoading}
            showSearch
            optionFilterProp="label"
            placeholder="選擇商品"
            options={availableProducts.map((p) => ({ value: p.id, label: `${p.name}（${p.category}）` }))}
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

        <Form.Item name="course_id" label="課程（選填，團體課適用）">
          <Select
            allowClear
            loading={coursesLoading}
            showSearch
            optionFilterProp="label"
            placeholder="選擇課程"
            options={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>

        <Form.Item name="purchase_id" label="使用購買紀錄（選填）">
          <Select
            allowClear
            placeholder="選擇要扣抵的購買紀錄"
            options={(purchases ?? []).map((p) => ({
              value: p.id,
              label: `#${p.id}｜剩餘 ${p.remaining_hours} 堂｜${p.purchase_date}`,
            }))}
          />
        </Form.Item>

        <Form.Item name="booking_date" label="預約日期" rules={[{ required: true, message: '請選擇日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="start_hour" label="時段" rules={[{ required: true, message: '請選擇時段' }]}>
          <Select placeholder="選擇時段" options={HOURS.map((h) => ({ value: h, label: `${h}:00` }))} />
        </Form.Item>

        <Form.Item name="people_count" label="人數" rules={[{ required: true, message: '請輸入人數' }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="notes" label="備註（選填）">
          <Input.TextArea rows={3} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
            送出申請
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

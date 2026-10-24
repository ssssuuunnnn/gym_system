import { useEffect, useState } from 'react';
import { App, Button, Card, Col, Form, Input, Row, Select, Space, Typography } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTenant, type Tenant, type TenantUpdatePayload } from '../../../../api/platform';
import { apiErrorMessage } from '../../../../api/platformClient';
import { formatServerTime } from '../../../../lib/datetime';
import { baseDomainWithPort } from '../../../../lib/host';
import { TIMEZONE_OPTIONS } from '../../../../lib/timezones';

type InfoValues = Required<Pick<TenantUpdatePayload, 'name' | 'timezone'>> &
  Pick<TenantUpdatePayload, 'contact_name' | 'contact_email' | 'contact_phone' | 'note'>;

const FIELDS: (keyof InfoValues)[] = ['name', 'timezone', 'contact_name', 'contact_email', 'contact_phone', 'note'];

function toValues(t: Tenant): InfoValues {
  return {
    name: t.name,
    timezone: t.timezone,
    contact_name: t.contact_name,
    contact_email: t.contact_email,
    contact_phone: t.contact_phone,
    note: t.note,
  };
}

export interface TenantInfoCardProps {
  tenant: Tenant;
}

/** 健身房基本資料與聯絡資訊；有修改才能儲存，只送出有變動的欄位。子網域不可修改。 */
export function TenantInfoCard({ tenant }: TenantInfoCardProps) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [form] = Form.useForm<InfoValues>();
  const [changed, setChanged] = useState<Partial<InfoValues>>({});

  useEffect(() => {
    form.setFieldsValue(toValues(tenant));
    setChanged({});
  }, [tenant, form]);

  const recomputeChanges = () => {
    const values = form.getFieldsValue();
    const original = toValues(tenant);
    const diff: Partial<InfoValues> = {};
    for (const field of FIELDS) {
      const now = (values[field] ?? '') || null;
      const was = (original[field] ?? '') || null;
      if (now !== was) Object.assign(diff, { [field]: values[field] ?? null });
    }
    setChanged(diff);
  };

  const mutation = useMutation({
    mutationFn: (payload: TenantUpdatePayload) => updateTenant(tenant.id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['platform-tenant', tenant.id], updated);
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-audit-logs'] });
      message.success('已儲存');
    },
    onError: (err) => message.error(apiErrorMessage(err, '儲存失敗')),
  });

  const dirty = Object.keys(changed).length > 0;

  return (
    <Card
      title="基本資料"
      extra={
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          最後更新 {formatServerTime(tenant.updated_at)}
        </Typography.Text>
      }
      actions={[
        <div key="save" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 24px' }}>
          <Button disabled={!dirty} onClick={() => { form.setFieldsValue(toValues(tenant)); setChanged({}); }}>
            復原
          </Button>
          <Button
            type="primary"
            disabled={!dirty}
            loading={mutation.isPending}
            onClick={async () => {
              await form.validateFields();
              mutation.mutate(changed);
            }}
          >
            儲存變更
          </Button>
        </div>,
      ]}
    >
      <Form form={form} layout="vertical" onValuesChange={recomputeChanges} requiredMark={false}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="name" label="健身房名稱" rules={[{ required: true, whitespace: true, message: '請輸入名稱' }]}>
              <Input maxLength={100} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="子網域" extra="網址、登入狀態與上傳檔案都跟著子網域，開通後不能修改">
              <Space.Compact style={{ width: '100%' }}>
                <Input value={tenant.subdomain} disabled />
                <Space.Addon>.{baseDomainWithPort()}</Space.Addon>
              </Space.Compact>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="timezone" label="時區" rules={[{ required: true }]}>
              <Select showSearch options={TIMEZONE_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="contact_name" label="聯絡人">
              <Input maxLength={100} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="contact_email" label="Email" rules={[{ type: 'email', message: 'Email 格式不正確' }]}>
              <Input maxLength={255} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="contact_phone" label="電話">
              <Input maxLength={50} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="note" label="平台內部備註" style={{ marginBottom: 0 }}>
              <Input.TextArea maxLength={1000} autoSize={{ minRows: 2, maxRows: 6 }} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );
}

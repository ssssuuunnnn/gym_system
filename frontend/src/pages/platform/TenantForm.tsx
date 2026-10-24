import { App, Breadcrumb, type InputProps, Button, Card, Checkbox, Col, Form, Input, Radio, Row, Select, Space, Typography } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  checkSubdomain,
  createTenant,
  TENANT_STATUSES,
  type Tenant,
  type TenantCreatePayload,
} from '../../api/platform';
import { apiErrorMessage } from '../../api/platformClient';
import { showCredentials } from '../../components/platform/credentials';
import { baseDomainWithPort, tenantUrl } from '../../lib/host';
import { generatePassword, MIN_PASSWORD_LENGTH } from '../../lib/password';
import { TIMEZONE_OPTIONS } from '../../lib/timezones';
import { usePageActionBar } from '../../store/pageActionBar';

/** 子網域輸入框＋固定的「.主網域」後綴（Form.Item 會注入 value / onChange） */
function SubdomainInput(props: InputProps) {
  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input {...props} maxLength={63} placeholder="pulsefit" />
      <Space.Addon>.{baseDomainWithPort()}</Space.Addon>
    </Space.Compact>
  );
}

const INITIAL_VALUES: Partial<TenantCreatePayload> = {
  timezone: 'Asia/Taipei',
  status: '試用',
  admin_username: 'admin',
  admin_must_change_password: true,
};

/**
 * 開通健身房：基本資料＋聯絡資訊＋第一位管理員，一次送出（後端同一個交易，失敗不會留下半套資料）。
 * 成功後顯示登入資訊，讓平台管理員交給健身房老闆。
 */
export default function TenantForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<TenantCreatePayload>();
  const subdomain = Form.useWatch('subdomain', form);

  const mutation = useMutation({
    mutationFn: createTenant,
    onSuccess: (tenant: Tenant, payload) => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-audit-logs'] });
      showCredentials(modal, {
        title: `已開通「${tenant.name}」`,
        credentials: {
          subdomain: tenant.subdomain,
          username: payload.admin_username,
          password: payload.admin_password,
          mustChangePassword: payload.admin_must_change_password,
        },
        okText: '查看健身房',
        onOk: () => navigate(`/tenants/${tenant.id}`),
      });
    },
    onError: (err) => message.error(apiErrorMessage(err, '開通失敗')),
  });

  const submit = async () => {
    try {
      const values = await form.validateFields();
      mutation.mutate({ ...values, subdomain: values.subdomain.trim().toLowerCase() });
    } catch {
      // 欄位錯誤已顯示在表單上
    }
  };

  usePageActionBar(
    <Space>
      <Button onClick={() => navigate('/tenants')}>取消</Button>
      <Button type="primary" onClick={submit} loading={mutation.isPending}>
        開通
      </Button>
    </Space>,
  );

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%', maxWidth: 960 }}>
      <Breadcrumb items={[{ title: <Link to="/tenants">健身房</Link> }, { title: '開通健身房' }]} />
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          開通健身房
        </Typography.Title>
        <Typography.Text type="secondary">建立健身房與第一位管理員帳號，開通後對方即可用自己的網址登入。</Typography.Text>
      </div>

      <Form form={form} layout="vertical" initialValues={INITIAL_VALUES} requiredMark="optional">
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Card title="基本資料">
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="name" label="健身房名稱" rules={[{ required: true, whitespace: true, message: '請輸入名稱' }]}>
                  <Input maxLength={100} placeholder="例如 PulseFit 健身工作室" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="subdomain"
                  label="子網域"
                  validateDebounce={400}
                  extra={
                    subdomain ? (
                      <>
                        網址：<Typography.Text code>{tenantUrl(subdomain.trim().toLowerCase())}</Typography.Text>
                        ，開通後不能修改
                      </>
                    ) : (
                      '小寫英文、數字與連字號，開通後不能修改'
                    )
                  }
                  rules={[
                    { required: true, message: '請輸入子網域' },
                    {
                      validator: async (_, value: string) => {
                        if (!value?.trim()) return;
                        const result = await checkSubdomain(value);
                        if (!result.available) throw new Error(result.reason ?? '這個子網域不能使用');
                      },
                    },
                  ]}
                  hasFeedback
                >
                  <SubdomainInput />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="timezone" label="時區" rules={[{ required: true }]} extra="預約、取消期限與簽到都以這個時區計算">
                  <Select showSearch options={TIMEZONE_OPTIONS} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="status" label="開通狀態">
                  <Radio.Group options={TENANT_STATUSES.filter((s) => s !== '停用')} />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card title="聯絡資訊">
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item name="contact_name" label="聯絡人">
                  <Input maxLength={100} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="contact_email" label="Email" rules={[{ type: 'email', message: 'Email 格式不正確' }]}>
                  <Input maxLength={255} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="contact_phone" label="電話">
                  <Input maxLength={50} />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="note" label="平台內部備註" extra="只有平台管理員看得到">
                  <Input.TextArea maxLength={1000} autoSize={{ minRows: 2, maxRows: 6 }} />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card title="第一位管理員" extra={<Typography.Text type="secondary">健身房負責人用這組帳號登入後台</Typography.Text>}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="admin_username" label="帳號" rules={[{ required: true, whitespace: true, message: '請輸入帳號' }]}>
                  <Input maxLength={100} autoComplete="off" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="密碼" required>
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item
                      name="admin_password"
                      noStyle
                      rules={[
                        { required: true, message: '請輸入密碼' },
                        { min: MIN_PASSWORD_LENGTH, message: `密碼至少 ${MIN_PASSWORD_LENGTH} 個字元` },
                      ]}
                    >
                      <Input.Password autoComplete="new-password" />
                    </Form.Item>
                    <Button onClick={() => form.setFieldValue('admin_password', generatePassword())}>產生密碼</Button>
                  </Space.Compact>
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="admin_must_change_password" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Checkbox>第一次登入時必須自行修改密碼（建議）</Checkbox>
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Space>
      </Form>
    </Space>
  );
}

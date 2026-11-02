import { useEffect } from 'react';
import { Alert, App, Button, Card, Flex, Form, Input, Space, Switch, Typography } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPlatformSettings, updatePlatformSettings, type PlatformSettingsPayload } from '../../api/platform';
import { apiErrorMessage } from '../../api/platformClient';
import { formatServerTime } from '../../lib/datetime';

const CONTACTS = [
  { field: 'contact_email', show: 'show_email', label: 'Email', placeholder: 'service@example.com' },
  {
    field: 'contact_line',
    show: 'show_line',
    label: 'LINE 官方帳號',
    placeholder: '@yourbrand 或 https://lin.ee/…',
    extra: '填 @ID，或貼 lin.ee／line.me 開頭的加好友網址',
  },
  { field: 'contact_phone', show: 'show_phone', label: '電話', placeholder: '02-1234-5678' },
] as const;

/**
 * 形象頁設定（ADR 0013）：平台首頁 platform.<主網域>/ 的品牌名稱、是否開放自助申請試用、聯絡方式。
 * 聯絡方式各有「顯示」開關，打開的才會出現在形象頁、以及試用到期的店家看到的「請聯絡我們」頁。
 */
export default function LandingSettings() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<PlatformSettingsPayload>();
  const { data, isLoading } = useQuery({ queryKey: ['platform-settings'], queryFn: getPlatformSettings });

  useEffect(() => {
    if (data) form.setFieldsValue(data);
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: updatePlatformSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(['platform-settings'], saved);
      queryClient.invalidateQueries({ queryKey: ['platform-audit-logs'] });
      message.success('已儲存，形象頁馬上更新');
    },
    onError: (err) => message.error(apiErrorMessage(err, '儲存失敗')),
  });

  const signupEnabled = Form.useWatch('signup_enabled', form);

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%', maxWidth: 720 }}>
      <Flex justify="space-between" align="flex-end" wrap gap={12}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            形象頁設定
          </Typography.Title>
          <Typography.Text type="secondary">平台首頁：介紹系統、讓有興趣的店家申請 30 天試用</Typography.Text>
        </div>
        <Button icon={<ExportOutlined />} href="/" target="_blank" rel="noopener">
          查看形象頁
        </Button>
      </Flex>

      <Form form={form} layout="vertical" disabled={isLoading} onFinish={(v) => mutation.mutate(v)}>
        <Card title="基本設定" style={{ marginBottom: 16 }}>
          <Form.Item
            name="brand_name"
            label="品牌名稱"
            htmlFor="landing-brand"
            rules={[{ required: true, whitespace: true, message: '請輸入品牌名稱' }]}
            extra="顯示在形象頁的頁首、標題與服務條款"
          >
            <Input id="landing-brand" maxLength={60} />
          </Form.Item>
          <Form.Item name="signup_enabled" label="開放自助申請試用" valuePropName="checked" htmlFor="landing-signup">
            <Switch id="landing-signup" checkedChildren="開放" unCheckedChildren="暫停" />
          </Form.Item>
          {signupEnabled === false && (
            <Alert
              type="info"
              showIcon
              title="暫停期間形象頁的申請表單會換成「目前暫停開放線上申請」，你仍可在「店家」頁手動開通。"
            />
          )}
        </Card>

        <Card title="聯絡方式">
          <Typography.Paragraph type="secondary">
            打開「顯示」的才會出現在形象頁，以及試用到期的店家看到的「請聯絡我們」頁。
          </Typography.Paragraph>
          {CONTACTS.map((c) => (
            <Form.Item key={c.field} label={c.label} htmlFor={`landing-${c.field}`} extra={'extra' in c ? c.extra : undefined}>
              <Flex gap={12} align="center">
                <Form.Item
                  name={c.field}
                  noStyle
                  rules={c.field === 'contact_email' ? [{ type: 'email', message: 'Email 格式不正確' }] : undefined}
                >
                  <Input id={`landing-${c.field}`} placeholder={c.placeholder} maxLength={200} allowClear />
                </Form.Item>
                <Flex gap={6} align="center" style={{ flex: 'none' }}>
                  <Form.Item name={c.show} valuePropName="checked" noStyle>
                    <Switch aria-label={`顯示${c.label}`} />
                  </Form.Item>
                  <Typography.Text type="secondary">顯示</Typography.Text>
                </Flex>
              </Flex>
            </Form.Item>
          ))}
          <Form.Item noStyle dependencies={CONTACTS.flatMap((c) => [c.field, c.show])}>
            {({ getFieldValue }) => {
              const blankShown = CONTACTS.filter((c) => getFieldValue(c.show) && !getFieldValue(c.field)?.trim());
              return blankShown.length ? (
                <Alert
                  type="warning"
                  showIcon
                  title={`${blankShown.map((c) => c.label).join('、')} 打開了顯示但沒有填，形象頁不會顯示`}
                />
              ) : null;
            }}
          </Form.Item>
        </Card>

        <Flex justify="space-between" align="center" style={{ marginTop: 16 }} wrap gap={12}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {data?.updated_by && `最後修改：${data.updated_by}・${formatServerTime(data.updated_at)}`}
          </Typography.Text>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>
            儲存
          </Button>
        </Flex>
      </Form>
    </Space>
  );
}

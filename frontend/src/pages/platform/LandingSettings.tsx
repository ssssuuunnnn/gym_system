import { useEffect } from 'react';
import { Alert, App, Button, Card, Flex, Form, Input, Space, Switch, Typography } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPlatformSettings, updatePlatformSettings, type PlatformSettingsPayload } from '../../api/platform';
import { apiErrorMessage } from '../../api/platformClient';
import { formatServerTime } from '../../lib/datetime';

const CONTACTS = [
  { field: 'contact_email', show: 'show_email', label: 'Email', placeholder: 'service@example.com' },
  { field: 'contact_phone', show: 'show_phone', label: '電話', placeholder: '02-1234-5678' },
] as const;

/** 和後端 services/trial.PublicContact.line_url 相同：@ID 轉成加好友網址，lin.ee／line.me 網址照用 */
function lineAddFriendUrl(value?: string | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (v.startsWith('https://lin.ee/') || v.startsWith('https://line.me/')) return v;
  if (v.startsWith('@')) return `https://line.me/R/ti/p/${v}`;
  return null;
}

/**
 * 形象頁設定（ADR 0013）：平台首頁 platform.<主網域>/ 的品牌名稱、是否開放自助申請試用、聯絡方式。
 * 聯絡方式各有「顯示」開關，打開的才會出現在形象頁、以及試用到期的店家看到的「請聯絡我們」頁；
 * LINE 官方帳號打開後形象頁到處都有「LINE 詢問」按鈕（R67），讓潛在客戶先問問題。
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

        <Card title="LINE 官方帳號詢問" style={{ marginBottom: 16 }}>
          <Typography.Paragraph type="secondary">
            讓有興趣的店家直接加平台的 LINE
            官方帳號問問題。打開「在前台顯示」後，形象頁的頁首、首屏、申請表單旁、聯絡區（電腦版附 QR
            Code）和手機右下角都會出現「LINE 詢問」按鈕，試用到期的店家也會在「請聯絡我們」頁看到。
          </Typography.Paragraph>
          <Form.Item
            name="contact_line"
            label="LINE 官方帳號"
            htmlFor="landing-contact_line"
            extra="填 @ID，或貼 lin.ee／line.me 開頭的加好友網址"
          >
            <Input id="landing-contact_line" placeholder="@yourbrand 或 https://lin.ee/…" maxLength={200} allowClear />
          </Form.Item>
          <Flex gap={12} align="center" wrap>
            <Flex gap={8} align="center">
              <Form.Item name="show_line" valuePropName="checked" noStyle>
                <Switch id="landing-show_line" checkedChildren="顯示" unCheckedChildren="隱藏" />
              </Form.Item>
              <label htmlFor="landing-show_line">在前台顯示「LINE 詢問」按鈕</label>
            </Flex>
            <Form.Item noStyle dependencies={['contact_line']}>
              {({ getFieldValue }) => {
                const url = lineAddFriendUrl(getFieldValue('contact_line'));
                return url ? (
                  <Button size="small" icon={<ExportOutlined />} href={url} target="_blank" rel="noopener">
                    測試加好友連結
                  </Button>
                ) : null;
              }}
            </Form.Item>
          </Flex>
        </Card>

        <Card title="其他聯絡方式">
          <Typography.Paragraph type="secondary">
            打開「顯示」的才會出現在形象頁，以及試用到期的店家看到的「請聯絡我們」頁。
          </Typography.Paragraph>
          {CONTACTS.map((c) => (
            <Form.Item key={c.field} label={c.label} htmlFor={`landing-${c.field}`}>
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
          <Form.Item
            noStyle
            dependencies={[...CONTACTS.flatMap((c) => [c.field, c.show]), 'contact_line', 'show_line']}
          >
            {({ getFieldValue }) => {
              const blankShown = [
                ...(getFieldValue('show_line') && !getFieldValue('contact_line')?.trim()
                  ? [{ label: 'LINE 官方帳號' }]
                  : []),
                ...CONTACTS.filter((c) => getFieldValue(c.show) && !getFieldValue(c.field)?.trim()),
              ];
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

import { useState } from 'react';
import { App, Button, Checkbox, Form, Input, Segmented, Typography, theme } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { lineJoin, lineLink, type LoginToken } from '../../../../api/lineOa';
import { apiErrorMessage } from '../../../../api/errors';
import FrontCard from '../../../../components/member/FrontCard';

type Mode = '加入會員' | '我已經是會員';

export interface JoinPanelProps {
  gymName: string;
  /** /auth/line 回傳的短效 token，只能用來加入或綁定 */
  linkToken: string;
  /** 用來預填姓名 */
  lineDisplayName: string | null;
  /** 加入或綁定成功 */
  onDone: (token: LoginToken) => void;
}

/** 在 LINE 裡第一次登入：加入會員（姓名、手機、同意個資告知）或用既有帳號密碼綁定。 */
export function JoinPanel({ gymName, linkToken, lineDisplayName, onDone }: JoinPanelProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [mode, setMode] = useState<Mode>('加入會員');

  const joinMutation = useMutation({
    mutationFn: (v: { display_name: string; phone: string; consent: boolean; marketing_consent: boolean }) =>
      lineJoin({ link_token: linkToken, ...v }),
    onSuccess: onDone,
    onError: (err) => message.error(apiErrorMessage(err)),
  });
  const linkMutation = useMutation({
    mutationFn: (v: { username: string; password: string }) => lineLink({ link_token: linkToken, ...v }),
    onSuccess: onDone,
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          歡迎來到{gymName}
        </Typography.Title>
        <Typography.Text type="secondary">
          {lineDisplayName ? `${lineDisplayName}，` : ''}加入會員後就能在 LINE 裡預約課程、查詢預約與購買方案。
        </Typography.Text>
      </div>

      <Segmented<Mode> block options={['加入會員', '我已經是會員']} value={mode} onChange={setMode} />

      <FrontCard>
        {mode === '加入會員' ? (
          <Form
            layout="vertical"
            requiredMark={false}
            initialValues={{ display_name: lineDisplayName ?? '', phone: '', consent: false, marketing_consent: false }}
            onFinish={(v) => joinMutation.mutate(v)}
          >
            <Form.Item label="姓名" name="display_name" rules={[{ required: true, whitespace: true, message: '請填寫姓名' }]}>
              <Input maxLength={50} autoComplete="name" />
            </Form.Item>
            <Form.Item
              label="手機"
              name="phone"
              extra="櫃台聯絡你、確認預約時使用"
              rules={[
                { required: true, message: '請填寫手機' },
                { pattern: /^[+\d][\d\s-]{7,18}$/, message: '手機號碼格式不正確' },
              ]}
            >
              <Input inputMode="tel" autoComplete="tel" placeholder="0912345678" maxLength={20} />
            </Form.Item>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.7,
                color: token.colorTextSecondary,
                background: token.colorFillAlter,
                borderRadius: token.borderRadius,
                padding: 12,
                marginBottom: 12,
              }}
            >
              <strong style={{ color: token.colorText }}>個人資料告知</strong>
              <br />
              {gymName}會蒐集你的姓名、手機與 LINE 帳號識別碼，用於會員管理、課程預約與聯絡。你可以隨時向櫃台查詢、更正或要求刪除。
            </div>
            <Form.Item
              name="consent"
              valuePropName="checked"
              rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error('請先閱讀並同意'))) }]}
            >
              <Checkbox>我已閱讀並同意個人資料告知</Checkbox>
            </Form.Item>
            {/* 行銷同意和個資告知分開、預設不勾（R31）；之後可在「我的」開關 */}
            <Form.Item name="marketing_consent" valuePropName="checked" style={{ marginTop: -12 }}>
              <Checkbox>我願意收到新課程、優惠與活動訊息（選填）</Checkbox>
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={joinMutation.isPending}>
              加入會員
            </Button>
          </Form>
        ) : (
          <Form layout="vertical" requiredMark={false} onFinish={(v) => linkMutation.mutate(v)}>
            <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
              用原本的會員帳號密碼綁定一次，之後打開 LINE 就會自動登入。
            </Typography.Paragraph>
            <Form.Item label="帳號" name="username" rules={[{ required: true, message: '請輸入帳號' }]}>
              <Input autoComplete="username" />
            </Form.Item>
            <Form.Item label="密碼" name="password" rules={[{ required: true, message: '請輸入密碼' }]}>
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={linkMutation.isPending}>
              綁定並登入
            </Button>
          </Form>
        )}
      </FrontCard>
    </div>
  );
}

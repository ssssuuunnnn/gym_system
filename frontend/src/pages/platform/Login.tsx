import { useState } from 'react';
import { App, Button, Card, Form, Input, Typography } from 'antd';
import { Navigate, useNavigate } from 'react-router-dom';
import { platformLogin } from '../../api/platform';
import { apiErrorMessage } from '../../api/platformClient';
import { usePlatformAuthStore } from '../../store/platformAuth';

/** 平台管理後台登入頁（platform.<主網域>/login），與各家健身房的登入頁分開。 */
export default function PlatformLogin() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { token, login } = usePlatformAuthStore();
  const [loading, setLoading] = useState(false);

  if (token) {
    return <Navigate to="/tenants" replace />;
  }

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const data = await platformLogin(values.username, values.password);
      login({ token: data.access_token, username: data.username });
      navigate('/tenants');
    } catch (err) {
      message.error(apiErrorMessage(err, '帳號或密碼錯誤'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 4 }}>
          平台管理
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ textAlign: 'center' }}>
          開通與管理各家健身房
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="username" label="帳號" rules={[{ required: true, message: '請輸入帳號' }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密碼" rules={[{ required: true, message: '請輸入密碼' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登入
          </Button>
        </Form>
      </Card>
    </div>
  );
}

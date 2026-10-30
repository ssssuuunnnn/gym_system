import { useState } from 'react';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { login as loginApi } from '../../api/auth';
import { useAuthStore } from '../../store/auth';
import { useShopTitle } from '../../lib/usePageTitle';

/**
 * 登入頁：管理員與教練（會員）共用登入入口。
 * 登入後依角色導向：管理員 → 預約審核列表；教練/學員 → 教練儀表板。
 */
export default function Login() {
  useShopTitle();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const data = await loginApi(values.username, values.password);
      // 換帳號登入時不要沿用上一個帳號的資料（權限、名單等）
      queryClient.clear();
      login({
        token: data.access_token,
        role: data.role,
        isCoach: data.is_coach,
        username: values.username,
        mustChangePassword: data.must_change_password,
      });
      if (data.must_change_password) {
        navigate('/member/change-password');
      } else {
        // 教練預設進入教練前台（今日課表），可在「我的」切換到會員模式
        navigate(data.role === 'admin' ? '/admin/dashboard' : data.is_coach ? '/coach/today' : '/member/dashboard');
      }
    } catch (err) {
      message.error('帳號或密碼錯誤');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>
          健身工作室管理系統
        </Typography.Title>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="帳號" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密碼" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登入
          </Button>
        </Form>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Link to="/register">還沒有帳號？前往註冊</Link>
        </div>
      </Card>
    </div>
  );
}

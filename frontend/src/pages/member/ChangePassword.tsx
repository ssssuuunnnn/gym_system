import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { changePassword } from '../../api/auth';
import { useAuthStore } from '../../store/auth';

/**
 * 會員修改密碼頁：管理員在「會員詳情」重設密碼並勾選「須自行修改密碼」後，
 * 會員登入即被導向此頁，完成修改前無法使用其他功能。
 */
export default function ChangePassword() {
  const navigate = useNavigate();
  const { role, isCoach, clearMustChangePassword, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { current: string; password: string; confirm: string }) => {
    if (values.password !== values.confirm) {
      message.error('兩次輸入的密碼不一致');
      return;
    }
    setLoading(true);
    try {
      await changePassword(values.current, values.password);
      clearMustChangePassword();
      message.success('密碼已更新');
      navigate(role === 'admin' ? '/admin/dashboard' : isCoach ? '/coach/today' : '/member/dashboard');
    } catch (err) {
      const detail = isAxiosError<{ detail?: string }>(err) ? err.response?.data?.detail : undefined;
      message.error(detail || '修改失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Card style={{ width: 400 }}>
        <Typography.Title level={4} style={{ textAlign: 'center' }}>
          修改登入密碼
        </Typography.Title>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="管理員已為你重設密碼"
          description="請設定一組新的登入密碼，完成後才能使用其他功能。"
        />
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="current" label="目前密碼" rules={[{ required: true, message: '請輸入目前密碼' }]}>
            <Input.Password placeholder="管理員提供的密碼" />
          </Form.Item>
          <Form.Item
            name="password"
            label="新密碼"
            rules={[
              { required: true, message: '請輸入新密碼' },
              { min: 8, message: '密碼長度需至少 8 碼' },
            ]}
          >
            <Input.Password placeholder="請輸入 8 碼以上新密碼" />
          </Form.Item>
          <Form.Item name="confirm" label="確認新密碼" rules={[{ required: true, message: '請再次輸入新密碼' }]}>
            <Input.Password placeholder="再次輸入新密碼" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            儲存新密碼
          </Button>
        </Form>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button
            type="link"
            size="small"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            登出並改用其他帳號登入
          </Button>
        </div>
      </Card>
    </div>
  );
}

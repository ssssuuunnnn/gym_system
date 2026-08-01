import { useState } from 'react';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { register as registerApi } from '../../api/auth';

/**
 * 會員註冊頁：場租教練、學員皆使用同一頁註冊（一律建立 role=member，
 * 是否為教練由管理員後續在「教練資料」畫面綁定）。
 */
export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { username: string; password: string; confirm: string }) => {
    if (values.password !== values.confirm) {
      message.error('兩次密碼輸入不一致');
      return;
    }
    setLoading(true);
    try {
      await registerApi(values.username, values.password);
      message.success('註冊成功，請登入');
      navigate('/login');
    } catch (err) {
      message.error('註冊失敗，帳號可能已被使用');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>
          會員註冊
        </Typography.Title>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="帳號" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密碼" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="confirm" label="確認密碼" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            提交
          </Button>
        </Form>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Link to="/login">已有帳號？前往登入</Link>
        </div>
      </Card>
    </div>
  );
}

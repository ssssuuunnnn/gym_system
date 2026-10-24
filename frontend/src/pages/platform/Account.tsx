import { App, Button, Card, Descriptions, Form, Input, Space, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { changePlatformPassword, getPlatformMe } from '../../api/platform';
import { apiErrorMessage } from '../../api/platformClient';
import { formatServerTime } from '../../lib/datetime';
import { MIN_PASSWORD_LENGTH } from '../../lib/password';

interface PasswordValues {
  current_password: string;
  new_password: string;
  confirm: string;
}

/** 平台管理員自己的帳號：查看登入資訊、修改密碼。 */
export default function Account() {
  const { message } = App.useApp();
  const [form] = Form.useForm<PasswordValues>();
  const { data: me } = useQuery({ queryKey: ['platform-me'], queryFn: getPlatformMe });
  const mutation = useMutation({
    mutationFn: (v: PasswordValues) => changePlatformPassword(v.current_password, v.new_password),
    onSuccess: () => {
      message.success('密碼已更新');
      form.resetFields();
    },
    onError: (err) => message.error(apiErrorMessage(err, '修改失敗')),
  });

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%', maxWidth: 560 }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        帳號設定
      </Typography.Title>
      <Card>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="帳號">{me?.username}</Descriptions.Item>
          <Descriptions.Item label="上次登入">{formatServerTime(me?.last_login_at)}</Descriptions.Item>
          <Descriptions.Item label="建立時間">{formatServerTime(me?.created_at)}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="修改密碼">
        <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)} requiredMark={false}>
          <Form.Item name="current_password" label="目前密碼" rules={[{ required: true, message: '請輸入目前密碼' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密碼"
            rules={[
              { required: true, message: '請輸入新密碼' },
              { min: MIN_PASSWORD_LENGTH, message: `密碼至少 ${MIN_PASSWORD_LENGTH} 個字元` },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="再輸入一次新密碼"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '請再輸入一次' },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value || value === getFieldValue('new_password')
                    ? Promise.resolve()
                    : Promise.reject(new Error('兩次輸入的密碼不一致')),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>
            更新密碼
          </Button>
        </Form>
      </Card>
    </Space>
  );
}

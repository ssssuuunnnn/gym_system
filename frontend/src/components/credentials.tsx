import { Space, Typography } from 'antd';
import type { useAppProps } from 'antd/es/app/context';

export interface Credentials {
  /** 登入網址（平台開通健身房時是那家的網址；健身房後台建立會員時是本站） */
  loginUrl: string;
  username: string;
  password: string;
  mustChangePassword: boolean;
}

/**
 * 顯示一次性的登入資訊（平台開通健身房、新增／重設管理員密碼，健身房把詢問轉成會員）。
 * 密碼不會再出現在任何畫面或紀錄，所以只在這裡顯示一次並提供複製。
 */
export function showCredentials(
  modal: useAppProps['modal'],
  { title, credentials, okText, onOk }: { title: string; credentials: Credentials; okText?: string; onOk?: () => void },
) {
  modal.success({
    title,
    width: 480,
    okText: okText ?? '我已記下',
    onOk,
    content: (
      <div>
        <Typography.Paragraph type="secondary">請以安全的方式交給對方。密碼只會顯示這一次。</Typography.Paragraph>
        <Space orientation="vertical" size={4}>
          <span>
            網址：<Typography.Text copyable>{credentials.loginUrl}</Typography.Text>
          </span>
          <span>
            帳號：<Typography.Text copyable>{credentials.username}</Typography.Text>
          </span>
          <span>
            密碼：
            <Typography.Text copyable code>
              {credentials.password}
            </Typography.Text>
          </span>
        </Space>
        {credentials.mustChangePassword && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
            對方下次登入時會被要求修改密碼。
          </Typography.Paragraph>
        )}
      </div>
    ),
  });
}

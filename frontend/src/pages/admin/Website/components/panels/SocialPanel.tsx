import { Form, Input, Space, Typography } from 'antd';
import { lineAddFriendUrl, type SiteContent } from '../../../../../api/website';
import type { PanelProps } from '../../lib';

type Contact = SiteContent['contact'];

/**
 * 社群連結：店家的官方 LINE、Instagram、Facebook、YouTube、Threads、TikTok。
 * 資料存在 contact 裡（舊網站不用搬資料）；填了才會出現在「交通與聯絡」段落、頁尾與結構化資料。
 */
export function SocialPanel({ value, onChange }: PanelProps<Contact>) {
  const set = (patch: Partial<Contact>) => onChange({ ...value, ...patch });
  const lineUrl = lineAddFriendUrl(value.line);
  return (
    <Form layout="vertical">
      <Typography.Paragraph type="secondary">
        填了的平台才會出現在網站上，訪客點了會開啟店家的頁面。這裡是店家的官方帳號，與員工個人的帳號無關。
      </Typography.Paragraph>
      <Form.Item
        htmlFor="site-social-line"
        label="LINE 官方帳號"
        extra={lineUrl ? `加好友連結：${lineUrl}` : '填 @ID，或貼上 lin.ee／line.me 開頭的加好友網址'}
      >
        <Input id="site-social-line" value={value.line} maxLength={200} placeholder="@pulsefit" onChange={(e) => set({ line: e.target.value })} />
      </Form.Item>
      <Form.Item htmlFor="site-social-instagram" label="Instagram" extra="填帳號名稱，或直接貼 Instagram 網址">
        <Space.Compact style={{ width: '100%' }}>
          <Space.Addon>instagram.com/</Space.Addon>
          <Input id="site-social-instagram" value={value.instagram} maxLength={200} placeholder="帳號名稱" onChange={(e) => set({ instagram: e.target.value })} />
        </Space.Compact>
      </Form.Item>
      <Form.Item htmlFor="site-social-facebook" label="Facebook 粉絲專頁">
        <Input id="site-social-facebook" value={value.facebook} maxLength={300} placeholder="https://www.facebook.com/…" onChange={(e) => set({ facebook: e.target.value })} />
      </Form.Item>
      <Form.Item htmlFor="site-social-youtube" label="YouTube 頻道" extra="填 @帳號，或貼頻道網址">
        <Input id="site-social-youtube" value={value.youtube} maxLength={300} placeholder="@pulsefit 或 https://www.youtube.com/@…" onChange={(e) => set({ youtube: e.target.value })} />
      </Form.Item>
      <Form.Item htmlFor="site-social-threads" label="Threads" extra="填帳號名稱，或直接貼 Threads 網址">
        <Space.Compact style={{ width: '100%' }}>
          <Space.Addon>threads.com/@</Space.Addon>
          <Input id="site-social-threads" value={value.threads} maxLength={200} placeholder="帳號名稱" onChange={(e) => set({ threads: e.target.value })} />
        </Space.Compact>
      </Form.Item>
      <Form.Item htmlFor="site-social-tiktok" label="TikTok" extra="填帳號名稱，或直接貼 TikTok 網址">
        <Space.Compact style={{ width: '100%' }}>
          <Space.Addon>tiktok.com/@</Space.Addon>
          <Input id="site-social-tiktok" value={value.tiktok} maxLength={200} placeholder="帳號名稱" onChange={(e) => set({ tiktok: e.target.value })} />
        </Space.Compact>
      </Form.Item>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
        會出現在「交通與聯絡」段落與頁尾。LINE 另外用在手機版底部的「LINE 詢問」按鈕，以及體驗表單送出後的「加入官方 LINE」。
      </Typography.Paragraph>
    </Form>
  );
}

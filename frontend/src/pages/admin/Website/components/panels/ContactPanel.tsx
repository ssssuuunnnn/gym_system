import { Col, Divider, Form, Input, Row, Space, Typography } from 'antd';
import { lineAddFriendUrl, type SiteContent } from '../../../../../api/website';
import type { PanelProps } from '../../lib';

type Contact = SiteContent['contact'];

/** 交通與聯絡：地址（自動帶地圖）、交通、電話、營業時間，以及官方 LINE、Instagram、Facebook。 */
export function ContactPanel({ value, onChange }: PanelProps<Contact>) {
  const set = (patch: Partial<Contact>) => onChange({ ...value, ...patch });
  const lineUrl = lineAddFriendUrl(value.line);
  return (
    <Form layout="vertical">
      <Form.Item htmlFor="site-contact-1" label="段落標題">
        <Input id="site-contact-1" value={value.title} maxLength={30} onChange={(e) => set({ title: e.target.value })} />
      </Form.Item>
      <Form.Item htmlFor="site-contact-2" label="地址" extra="網站會依地址自動顯示 Google 地圖">
        <Input id="site-contact-2" value={value.address} maxLength={100} placeholder="台北市大安區…" onChange={(e) => set({ address: e.target.value })} />
      </Form.Item>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item htmlFor="site-contact-3" label="交通說明">
            <Input id="site-contact-3" value={value.transport} maxLength={200} placeholder="捷運大安站 6 號出口步行 3 分鐘" onChange={(e) => set({ transport: e.target.value })} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item htmlFor="site-contact-4" label="電話">
            <Input id="site-contact-4" value={value.phone} maxLength={30} placeholder="02-1234-5678" onChange={(e) => set({ phone: e.target.value })} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item htmlFor="site-contact-5" label="營業時間">
        <Input.TextArea id="site-contact-5" value={value.hours} maxLength={200} autoSize={{ minRows: 2, maxRows: 5 }} placeholder={'週一至週五 10:00–22:00\n週六、日 10:00–18:00'} onChange={(e) => set({ hours: e.target.value })} />
      </Form.Item>

      <Divider titlePlacement="start" style={{ fontSize: 14 }}>
        社群與通訊
      </Divider>
      <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
        填了才會出現在網站上。這裡是健身房的官方帳號，與教練個人的 LINE 無關。
      </Typography.Paragraph>
      <Form.Item htmlFor="site-contact-6" label="LINE 官方帳號" extra={lineUrl ? `加好友連結：${lineUrl}` : '填 @ID，或貼上 lin.ee／line.me 開頭的加好友網址'}>
        <Input id="site-contact-6" value={value.line} maxLength={200} placeholder="@pulsefit" onChange={(e) => set({ line: e.target.value })} />
      </Form.Item>
      <Form.Item htmlFor="site-contact-7" label="Instagram">
        <Space.Compact style={{ width: '100%' }}>
          <Space.Addon>instagram.com/</Space.Addon>
          <Input id="site-contact-7" value={value.instagram} maxLength={200} placeholder="帳號名稱" onChange={(e) => set({ instagram: e.target.value })} />
        </Space.Compact>
      </Form.Item>
      <Form.Item htmlFor="site-contact-8" label="Facebook 粉絲專頁">
        <Input id="site-contact-8" value={value.facebook} maxLength={300} placeholder="https://www.facebook.com/…" onChange={(e) => set({ facebook: e.target.value })} />
      </Form.Item>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
        會出現在「交通與聯絡」段落、頁尾、手機版底部的「LINE 詢問」按鈕（未填 LINE 就不顯示），以及體驗課表單送出後的「加入官方 LINE」。
      </Typography.Paragraph>
    </Form>
  );
}

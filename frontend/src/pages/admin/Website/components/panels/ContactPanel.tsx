import { Col, Form, Input, Row, Typography } from 'antd';
import type { SiteContent } from '../../../../../api/website';
import type { PanelProps } from '../../lib';

type Contact = SiteContent['contact'];

/** 交通與聯絡：地址（自動帶地圖）、交通、電話、營業時間。社群平台在 SocialPanel。 */
export function ContactPanel({ value, onChange }: PanelProps<Contact>) {
  const set = (patch: Partial<Contact>) => onChange({ ...value, ...patch });
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

      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
        LINE、Instagram、Facebook、YouTube 等社群平台請在左側「社群連結」設定，會一起顯示在這個段落與頁尾。
      </Typography.Paragraph>
    </Form>
  );
}

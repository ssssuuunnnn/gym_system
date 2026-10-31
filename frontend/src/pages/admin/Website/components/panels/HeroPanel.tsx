import { Form, Input } from 'antd';
import type { SiteContent } from '../../../../../api/website';
import type { PanelProps } from '../../lib';
import { SiteImageUploader } from '../../../../../components/SiteImageUploader';

type Hero = SiteContent['hero'];

/** 主視覺：網站最上方的標語、說明與大圖。 */
export function HeroPanel({ value, onChange }: PanelProps<Hero>) {
  const set = (patch: Partial<Hero>) => onChange({ ...value, ...patch });
  return (
    <Form layout="vertical">
      <Form.Item htmlFor="site-hero-1" label="標語" extra="留空時顯示公司名稱">
        <Input id="site-hero-1" value={value.tagline} maxLength={40} showCount onChange={(e) => set({ tagline: e.target.value })} placeholder="小班制訓練，陪你練出看得見的改變" />
      </Form.Item>
      <Form.Item htmlFor="site-hero-2" label="說明">
        <Input.TextArea id="site-hero-2" value={value.description} maxLength={200} showCount autoSize={{ minRows: 3, maxRows: 6 }} onChange={(e) => set({ description: e.target.value })} />
      </Form.Item>
      <Form.Item label="主視覺照片">
        <SiteImageUploader value={value.image_url} onChange={(url) => set({ image_url: url })} hint="建議橫式 1600×1000" />
      </Form.Item>
      <Form.Item htmlFor="site-hero-3" label="標語上方小字（選填）" extra="例如地點：TAIPEI · DA'AN">
        <Input id="site-hero-3" value={value.eyebrow} maxLength={40} onChange={(e) => set({ eyebrow: e.target.value })} />
      </Form.Item>
    </Form>
  );
}

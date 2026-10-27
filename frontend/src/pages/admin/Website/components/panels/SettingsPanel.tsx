import { Button, Card, Form, Input, Space, Tag, Typography, theme } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { BRAND_COLORS, type SiteContent } from '../../../../../api/website';
import { ImageUploader } from '../ImageUploader';

export interface SettingsPanelProps {
  content: SiteContent;
  onChange: (patch: Partial<SiteContent>) => void;
}

/** 網站設定：版型、品牌色、搜尋與分享（標題、描述、預覽圖），附 LINE 分享預覽。 */
export function SettingsPanel({ content, onChange }: SettingsPanelProps) {
  const { token } = theme.useToken();
  const seo = content.seo;
  const setSeo = (patch: Partial<SiteContent['seo']>) => onChange({ seo: { ...seo, ...patch } });
  const shareImage = seo.og_image_url || content.hero.image_url;

  return (
    <Form layout="vertical">
      <Form.Item label="版型" extra="更多版型會陸續推出">
        <Card size="small" style={{ width: 220, borderColor: token.colorPrimary }}>
          <div style={{ height: 64, borderRadius: token.borderRadiusSM, background: token.colorText, marginBottom: 8 }} />
          <Space>
            <strong>活力</strong>
            <Tag color="blue">使用中</Tag>
          </Space>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>深色主視覺、大標題</div>
        </Card>
      </Form.Item>

      <Form.Item label="品牌色" extra="按鈕、標題小字與重點色。每個顏色都確認過文字看得清楚。">
        <Space wrap>
          {BRAND_COLORS.map((c) => {
            const selected = content.brand_color === c.hex;
            return (
              <Button
                key={c.hex}
                shape="circle"
                aria-label={c.name}
                aria-pressed={selected}
                title={c.name}
                onClick={() => onChange({ brand_color: c.hex })}
                icon={selected ? <CheckOutlined style={{ color: token.colorWhite }} /> : undefined}
                style={{
                  width: 40,
                  height: 40,
                  background: c.hex,
                  borderColor: selected ? token.colorPrimaryBorder : c.hex,
                  boxShadow: selected ? `0 0 0 3px ${token.colorPrimaryBorder}` : 'none',
                }}
              />
            );
          })}
        </Space>
      </Form.Item>

      <Form.Item htmlFor="site-settings-1" label="搜尋與分享標題" extra="留空時使用公司名稱">
        <Input id="site-settings-1" value={seo.title} maxLength={70} showCount onChange={(e) => setSeo({ title: e.target.value })} />
      </Form.Item>
      <Form.Item htmlFor="site-settings-2" label="搜尋與分享描述" extra="留空時使用主視覺的說明">
        <Input.TextArea id="site-settings-2"
          value={seo.description}
          maxLength={160}
          showCount
          autoSize={{ minRows: 2, maxRows: 4 }}
          onChange={(e) => setSeo({ description: e.target.value })}
        />
      </Form.Item>
      <Form.Item label="分享預覽圖" extra="未設定時使用主視覺照片">
        <ImageUploader value={seo.og_image_url} onChange={(url) => setSeo({ og_image_url: url })} hint="建議 1200×630" height={140} />
      </Form.Item>

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        LINE、Facebook 分享時大致會長這樣：
      </Typography.Text>
      <div
        style={{
          marginTop: 8,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          overflow: 'hidden',
          maxWidth: 360,
        }}
      >
        {shareImage ? (
          <img src={shareImage} alt="" style={{ width: '100%', height: 160, objectFit: 'cover' }} />
        ) : (
          <div style={{ height: 80, background: token.colorFillTertiary }} />
        )}
        <div style={{ padding: 12 }}>
          <div style={{ fontWeight: 600 }}>{seo.title || '（公司名稱）'}</div>
          <div style={{ color: token.colorTextSecondary, fontSize: 13 }}>
            {seo.description || content.hero.description || '（主視覺說明）'}
          </div>
        </div>
      </div>
    </Form>
  );
}

import { Card, Col, Form, Input, Row, Typography, theme } from 'antd';
import type { SiteContent } from '../../../../../api/website';
import { moveItem, removeItem, replaceItem, type PanelProps } from '../../lib';
import { ImageUploader } from '../ImageUploader';
import { ListItemActions } from '../ListItemActions';

type Gallery = SiteContent['gallery'];
const MAX_IMAGES = 12;

/** 環境照片：最多 12 張，第一張放大顯示；可加說明、調整順序。 */
export function GalleryPanel({ value, onChange }: PanelProps<Gallery>) {
  const { token } = theme.useToken();
  const set = (images: Gallery['images']) => onChange({ ...value, images });
  return (
    <Form layout="vertical">
      <Form.Item htmlFor="site-gallery-1" label="段落標題">
        <Input id="site-gallery-1" value={value.title} maxLength={30} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      </Form.Item>
      <Typography.Paragraph type="secondary">
        第一張會放大顯示。共 {value.images.length} / {MAX_IMAGES} 張。
      </Typography.Paragraph>
      <Row gutter={[12, 12]}>
        {value.images.map((img, i) => (
          <Col key={img.url} xs={24} md={12}>
            <Card
              size="small"
              cover={<img src={img.url} alt={img.caption} style={{ height: 140, objectFit: 'cover' }} />}
              extra={
                <ListItemActions
                  index={i}
                  count={value.images.length}
                  label={img.caption || `照片 ${i + 1}`}
                  onMove={(d) => set(moveItem(value.images, i, d))}
                  onRemove={() => set(removeItem(value.images, i))}
                />
              }
              title={<span style={{ fontSize: 12, color: token.colorTextSecondary }}>照片 {i + 1}</span>}
            >
              <Input
                value={img.caption}
                maxLength={40}
                placeholder="說明（選填），例如：訓練區"
                aria-label={`照片 ${i + 1} 說明`}
                onChange={(e) => set(replaceItem(value.images, i, { ...img, caption: e.target.value }))}
              />
            </Card>
          </Col>
        ))}
        {value.images.length < MAX_IMAGES && (
          <Col xs={24} md={12}>
            <ImageUploader value={null} onChange={(url) => url && set([...value.images, { url, caption: '' }])} height={140} />
          </Col>
        )}
      </Row>
    </Form>
  );
}

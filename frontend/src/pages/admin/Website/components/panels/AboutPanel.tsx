import { Button, Card, Form, Input, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { SiteContent } from '../../../../../api/website';
import { moveItem, removeItem, replaceItem, type PanelProps } from '../../lib';
import { ListItemActions } from '../ListItemActions';

type About = SiteContent['about'];
const MAX_FEATURES = 3;

/** 關於我們：介紹文字＋最多 3 個特色。 */
export function AboutPanel({ value, onChange }: PanelProps<About>) {
  const set = (patch: Partial<About>) => onChange({ ...value, ...patch });
  return (
    <Form layout="vertical">
      <Form.Item htmlFor="site-about-1" label="段落標題">
        <Input id="site-about-1" value={value.title} maxLength={30} onChange={(e) => set({ title: e.target.value })} />
      </Form.Item>
      <Form.Item htmlFor="site-about-2" label="介紹" extra="成立理念、訓練方式、適合哪些人，建議 100～200 字">
        <Input.TextArea id="site-about-2" value={value.text} maxLength={1000} showCount autoSize={{ minRows: 4, maxRows: 10 }} onChange={(e) => set({ text: e.target.value })} />
      </Form.Item>
      <Form.Item label={`特色（最多 ${MAX_FEATURES} 個）`}>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {value.features.map((f, i) => (
            <Card
              key={i}
              size="small"
              title={`特色 ${i + 1}`}
              extra={
                <ListItemActions
                  index={i}
                  count={value.features.length}
                  label={f.title || `特色 ${i + 1}`}
                  onMove={(d) => set({ features: moveItem(value.features, i, d) })}
                  onRemove={() => set({ features: removeItem(value.features, i) })}
                />
              }
            >
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Input placeholder="標題，例如：小班制" value={f.title} maxLength={20} aria-label={`特色 ${i + 1} 標題`} onChange={(e) => set({ features: replaceItem(value.features, i, { ...f, title: e.target.value }) })} />
                <Input placeholder="一句說明" value={f.text} maxLength={60} aria-label={`特色 ${i + 1} 說明`} onChange={(e) => set({ features: replaceItem(value.features, i, { ...f, text: e.target.value }) })} />
              </Space>
            </Card>
          ))}
          {value.features.length < MAX_FEATURES && (
            <Button type="dashed" block icon={<PlusOutlined />} onClick={() => set({ features: [...value.features, { title: '', text: '' }] })}>
              新增特色
            </Button>
          )}
        </Space>
      </Form.Item>
    </Form>
  );
}

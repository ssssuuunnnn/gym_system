import { Button, Card, Form, Input, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { SiteContent } from '../../../../../api/website';
import { moveItem, removeItem, replaceItem, type PanelProps } from '../../lib';
import { ListItemActions } from '../ListItemActions';

type Faq = SiteContent['faq'];
const MAX_ITEMS = 20;

/** 常見問題：問題與回答，可新增、刪除、排序。空白的題目在儲存前會被略過。 */
export function FaqPanel({ value, onChange }: PanelProps<Faq>) {
  const set = (items: Faq['items']) => onChange({ ...value, items });
  return (
    <Form layout="vertical">
      <Form.Item htmlFor="site-faq-1" label="段落標題">
        <Input id="site-faq-1" value={value.title} maxLength={30} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      </Form.Item>
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {value.items.map((item, i) => (
          <Card
            key={i}
            size="small"
            title={`問題 ${i + 1}`}
            extra={
              <ListItemActions
                index={i}
                count={value.items.length}
                label={item.q || `問題 ${i + 1}`}
                onMove={(d) => set(moveItem(value.items, i, d))}
                onRemove={() => set(removeItem(value.items, i))}
              />
            }
          >
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Input value={item.q} maxLength={60} placeholder="問題，例如：第一次去要準備什麼？" aria-label={`問題 ${i + 1}`} onChange={(e) => set(replaceItem(value.items, i, { ...item, q: e.target.value }))} />
              <Input.TextArea value={item.a} maxLength={500} autoSize={{ minRows: 2, maxRows: 6 }} placeholder="回答" aria-label={`問題 ${i + 1} 的回答`} onChange={(e) => set(replaceItem(value.items, i, { ...item, a: e.target.value }))} />
            </Space>
          </Card>
        ))}
        {value.items.length < MAX_ITEMS && (
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => set([...value.items, { q: '', a: '' }])}>
            新增問題
          </Button>
        )}
      </Space>
    </Form>
  );
}

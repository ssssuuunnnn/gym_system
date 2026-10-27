import { Checkbox, Form, Input, List, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listProducts, type Product } from '../../../../../api/products';
import type { SiteContent } from '../../../../../api/website';
import { moveItem, type PanelProps } from '../../lib';
import { ListItemActions } from '../ListItemActions';

type Pricing = SiteContent['pricing'];

const price = (p: Product) => `NT$ ${Number(p.price).toLocaleString('zh-TW')}`;

/** 方案價格：從商品管理勾選要公開的方案與順序，可加一句網站用說明；價格跟著商品。 */
export function PricingPanel({ value, onChange }: PanelProps<Pricing>) {
  const { data: products = [], isLoading } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const byId = new Map(products.map((p) => [p.id, p]));
  const shown = value.items.filter((i) => byId.has(i.product_id));
  const listed = new Set(shown.map((i) => i.product_id));
  const others = products.filter((p) => p.is_active && !listed.has(p.id));
  const setItems = (items: Pricing['items']) => onChange({ ...value, items });

  return (
    <Form layout="vertical">
      <Typography.Paragraph type="secondary">
        名稱與價格來自<Link to="/admin/products">商品管理</Link>，改價格不需要回來這裡；停售的商品不會顯示在網站上。
      </Typography.Paragraph>
      <Form.Item htmlFor="site-pricing-1" label="段落標題">
        <Input id="site-pricing-1" value={value.title} maxLength={30} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      </Form.Item>

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        公開的方案（{shown.length}）
      </Typography.Title>
      <List
        loading={isLoading}
        dataSource={shown}
        locale={{ emptyText: '還沒有公開的方案，從下方勾選' }}
        renderItem={(item, index) => {
          const p = byId.get(item.product_id)!;
          return (
            <List.Item
              actions={[
                <ListItemActions key="move" index={index} count={shown.length} label={p.name} onMove={(d) => setItems(moveItem(shown, index, d))} />,
                <Checkbox key="public" checked onChange={() => setItems(shown.filter((x) => x.product_id !== item.product_id))}>
                  公開
                </Checkbox>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space wrap>
                    {p.name}
                    <Tag>{p.category}</Tag>
                    <Typography.Text>{price(p)}</Typography.Text>
                    {!p.is_active && <Tag color="red">已停售，網站不會顯示</Tag>}
                  </Space>
                }
                description={
                  <Input
                    value={item.description}
                    maxLength={80}
                    placeholder="網站用的一句說明，例如：一對一，可指定教練"
                    aria-label={`${p.name} 的網站說明`}
                    onChange={(e) =>
                      setItems(shown.map((x) => (x.product_id === item.product_id ? { ...x, description: e.target.value } : x)))
                    }
                  />
                }
              />
            </List.Item>
          );
        }}
      />

      {others.length > 0 && (
        <>
          <Typography.Title level={5}>可加入的方案</Typography.Title>
          <List
            size="small"
            dataSource={others}
            renderItem={(p) => (
              <List.Item
                actions={[
                  <Checkbox key="public" checked={false} onChange={() => setItems([...shown, { product_id: p.id, description: '' }])}>
                    公開
                  </Checkbox>,
                ]}
              >
                <Space wrap>
                  {p.name}
                  <Tag>{p.category}</Tag>
                  <Typography.Text type="secondary">{price(p)}</Typography.Text>
                </Space>
              </List.Item>
            )}
          />
        </>
      )}

      <Form.Item htmlFor="site-pricing-2" label="價格備註" style={{ marginTop: 16 }}>
        <Input id="site-pricing-2" value={value.note} maxLength={200} onChange={(e) => onChange({ ...value, note: e.target.value })} />
      </Form.Item>
    </Form>
  );
}

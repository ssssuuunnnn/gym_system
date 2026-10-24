import { useState } from 'react';
import {
  Alert,
  Card,
  Typography,
  Form,
  Select,
  InputNumber,
  Button,
  Descriptions,
  Popconfirm,
  Empty,
  message,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { listProducts } from '../../api/products';
import { createSelfPurchase } from '../../api/purchases';

/**
 * 購買商品（會員）：選擇商品（資料來源＝商品管理），選定後顯示該商品資訊，
 * 輸入數量後點「購買」即以自己的名義建立購買紀錄。金額由後端依單價 × 數量帶入。
 */
export default function BuyProduct() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState<number>();
  const [quantity, setQuantity] = useState<number>(1);

  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: listProducts });

  // 僅提供上架中的商品
  const availableProducts = (products ?? []).filter((p) => p.is_active);
  const selectedProduct = availableProducts.find((p) => p.id === productId);
  const isSupply = selectedProduct?.category === '用品';
  const outOfStock = isSupply && (selectedProduct?.stock ?? 0) < quantity;
  const total = selectedProduct ? selectedProduct.price * quantity : 0;

  const buyMutation = useMutation({
    mutationFn: () => createSelfPurchase({ product_id: productId as number, quantity }),
    onSuccess: () => {
      message.success('已建立訂單，請向櫃台付款，確認收款後即可使用堂數');
      queryClient.invalidateQueries({ queryKey: ['my-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/member/products');
    },
    onError: (error) => {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      message.error(detail || '購買失敗，請稍後再試');
    },
  });

  return (
    <Card>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        購買商品
      </Typography.Title>
      <Form layout="vertical" style={{ maxWidth: 480 }}>
        <Form.Item label="商品" required>
          <Select
            loading={isLoading}
            showSearch
            optionFilterProp="label"
            placeholder="選擇商品"
            value={productId}
            onChange={(value) => {
              setProductId(value);
              setQuantity(1);
            }}
            options={availableProducts.map((p) => ({
              value: p.id,
              label:
                p.category === '用品'
                  ? `${p.name}（用品｜庫存 ${p.stock ?? 0}）`
                  : `${p.name}（${p.category}｜${p.session_hours} 堂）`,
              disabled: p.category === '用品' && (p.stock ?? 0) <= 0,
            }))}
          />
        </Form.Item>

        {selectedProduct ? (
          <Descriptions
            column={1}
            size="small"
            bordered
            style={{ marginBottom: 24 }}
            items={[
              { key: 'name', label: '商品名稱', children: selectedProduct.name },
              { key: 'category', label: '分類', children: selectedProduct.category },
              isSupply
                ? { key: 'stock', label: '庫存', children: `${selectedProduct.stock ?? 0}` }
                : { key: 'hours', label: '堂數', children: `${selectedProduct.session_hours} 堂` },
              { key: 'price', label: '單價', children: `NT$ ${selectedProduct.price}` },
            ]}
          />
        ) : (
          <Empty description="請先選擇商品" style={{ margin: '24px 0' }} />
        )}

        <Form.Item label="數量" required>
          <InputNumber
            min={1}
            max={isSupply ? (selectedProduct?.stock ?? undefined) : undefined}
            value={quantity}
            onChange={(value) => setQuantity(value ?? 1)}
            style={{ width: '100%' }}
            disabled={!selectedProduct}
          />
        </Form.Item>

        <Form.Item label="應付金額">
          <Typography.Text strong style={{ fontSize: 18 }}>
            NT$ {total}
          </Typography.Text>
        </Form.Item>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="送出後訂單為「待付款」，請向櫃台付款；工作室確認收款後，堂數才會入帳可預約。"
        />

        <Popconfirm
          title="確認購買"
          description={selectedProduct ? `購買「${selectedProduct.name}」× ${quantity}，應付 NT$ ${total}` : ''}
          okText="確認"
          cancelText="取消"
          disabled={!selectedProduct || outOfStock}
          onConfirm={() => buyMutation.mutate()}
        >
          <Button
            type="primary"
            loading={buyMutation.isPending}
            disabled={!selectedProduct || outOfStock}
          >
            {outOfStock ? '庫存不足' : '送出訂單'}
          </Button>
        </Popconfirm>
      </Form>
    </Card>
  );
}

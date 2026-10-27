import { useEffect, useState } from 'react';
import { Button, InputNumber, Result, theme } from 'antd';
import type { Product } from '../../../../api/products';
import type { Purchase } from '../../../../api/purchases';
import BottomSheet from '../../../../components/member/BottomSheet';
import { MEMBER_CATEGORY_LABEL, formatPrice } from '../lib';

export interface OrderSheetProps {
  /** 要購買的方案；null 時關閉 */
  product: Product | null;
  courseName?: string;
  /** 送出成功後的訂單；有值時顯示「訂單已送出」與付款方式 */
  order: Purchase | null;
  /** 系統設定的付款方式說明 */
  paymentInstructions: string | null;
  /** 想預約的那堂課（一行說明）；有值時提醒收款後回來預約 */
  intentLabel: string | null;
  submitting: boolean;
  onSubmit: (quantity: number) => void;
  onClose: () => void;
  onViewOrders: () => void;
}

/** 購買方案的底部面板：選數量 → 送出訂單（待付款）→ 顯示付款方式。 */
export function OrderSheet(props: OrderSheetProps) {
  const { product, courseName, order, paymentInstructions, intentLabel, submitting, onSubmit, onClose, onViewOrders } = props;
  const { token } = theme.useToken();
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (product) setQuantity(1);
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSupply = product?.category === '用品';
  const maxQuantity = isSupply ? Math.max(1, product?.stock ?? 1) : 20;
  const total = (product?.price ?? 0) * quantity;
  const row = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 0',
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  } as const;
  const infoBox = {
    background: token.colorFillAlter,
    borderRadius: token.borderRadiusLG,
    padding: 14,
    fontSize: 14,
    lineHeight: 1.7,
  } as const;

  return (
    <BottomSheet open={product !== null} title={order ? '訂單已送出' : '確認購買'} onClose={onClose}>
      {product && !order && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{product.name}</div>
            <div style={{ fontSize: 13, color: token.colorTextSecondary }}>
              {[MEMBER_CATEGORY_LABEL[product.category], isSupply ? null : `${product.session_hours} 堂`, courseName]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <dl style={{ margin: 0, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
            <div style={row}>
              <dt style={{ fontSize: 14, color: token.colorTextSecondary }}>
                <label htmlFor="order-quantity">數量</label>
              </dt>
              <dd style={{ margin: 0 }}>
                <InputNumber
                  id="order-quantity"
                  mode="spinner"
                  min={1}
                  max={maxQuantity}
                  precision={0}
                  value={quantity}
                  onChange={(v) => setQuantity(v ?? 1)}
                  style={{ width: 140 }}
                />
              </dd>
            </div>
            {!isSupply && (
              <div style={row}>
                <dt style={{ fontSize: 14, color: token.colorTextSecondary }}>入帳堂數</dt>
                <dd style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{product.session_hours * quantity} 堂</dd>
              </div>
            )}
            <div style={row}>
              <dt style={{ fontSize: 14, color: token.colorTextSecondary }}>應付金額</dt>
              <dd style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{formatPrice(total)}</dd>
            </div>
          </dl>
          <p style={{ margin: 0, fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.6 }}>
            送出後訂單為「待付款」，工作室確認收款後{isSupply ? '即完成訂單' : '堂數才會入帳、可以預約'}。
          </p>
          <Button type="primary" size="large" block loading={submitting} onClick={() => onSubmit(quantity)} style={{ fontWeight: 700 }}>
            送出訂單
          </Button>
          <Button type="text" size="large" block onClick={onClose}>
            再看看
          </Button>
        </div>
      )}

      {product && order && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Result
            status="success"
            style={{ padding: '4px 0 0' }}
            title={`${product.name} × ${order.quantity}`}
            subTitle={`應付 ${formatPrice(order.amount)}・待付款`}
          />
          <div style={infoBox}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>付款方式</div>
            <div style={{ whiteSpace: 'pre-line' }}>{paymentInstructions || '請向櫃台付款（現金、轉帳或刷卡）。'}</div>
          </div>
          {intentLabel && (
            <div style={{ ...infoBox, background: token.colorPrimaryBg }}>
              工作室確認收款後，打開「預約課程」就會直接回到
              <strong> {intentLabel} </strong>
              。已綁定 LINE 的話，收款時也會收到通知。
            </div>
          )}
          <Button type="primary" size="large" block onClick={onViewOrders} style={{ fontWeight: 700 }}>
            查看我的方案與訂單
          </Button>
          <Button type="text" size="large" block onClick={onClose}>
            繼續逛逛
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}

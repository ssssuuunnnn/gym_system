import { Tag, theme } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import type { Product } from '../../../../api/products';
import { memberCategoryLabel, formatPrice } from '../lib';
import { useTerms } from '../../../../lib/terms';

export interface PlanCardProps {
  product: Product;
  /** 團體課方案綁定的課程名稱 */
  courseName?: string;
  /** 可以用來預約會員想約的那堂課 */
  recommended?: boolean;
  onSelect: () => void;
}

/** 購買方案頁的一張方案卡：名稱、分類與堂數、價格（課程類加每堂均價）；整張可點。 */
export function PlanCard({ product, courseName, recommended, onSelect }: PlanCardProps) {
  const { token } = theme.useToken();
  const isSupply = product.category === '用品';
  const { t } = useTerms();
  const soldOut = isSupply && (product.stock ?? 0) <= 0;
  const perSession = !isSupply && product.session_hours > 0 ? Math.round(product.price / product.session_hours) : null;

  const meta = [
    memberCategoryLabel(product.category, t),
    isSupply ? `庫存 ${product.stock ?? 0}` : `${product.session_hours} ${t.unit}`,
    courseName,
  ].filter(Boolean);

  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={onSelect}
      aria-label={`${product.name}，${formatPrice(product.price)}${soldOut ? '，已售完' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: 16,
        textAlign: 'left',
        fontFamily: 'inherit',
        color: token.colorText,
        background: token.colorBgContainer,
        border: `${recommended ? 2 : 1}px solid ${recommended ? token.colorPrimary : token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        cursor: soldOut ? 'not-allowed' : 'pointer',
        opacity: soldOut ? 0.55 : 1,
      }}
    >
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{product.name}</span>
          {recommended && (
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>
              適用這個時段
            </Tag>
          )}
          {soldOut && <Tag style={{ marginInlineEnd: 0 }}>已售完</Tag>}
        </span>
        <span style={{ fontSize: 13, color: token.colorTextSecondary }}>{meta.join(' · ')}</span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: 'none' }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{formatPrice(product.price)}</span>
        {perSession !== null && product.session_hours > 1 && (
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>每{t.unit}約 {formatPrice(perSession)}</span>
        )}
      </span>
      <RightOutlined aria-hidden="true" style={{ fontSize: 12, color: token.colorTextSecondary }} />
    </button>
  );
}

import { useMemo, useState } from 'react';
import { App, Segmented, Skeleton, theme } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCourses } from '../../../api/courses';
import { listProducts, type Product, type ProductCategory } from '../../../api/products';
import { createSelfPurchase, listPurchases, type Purchase } from '../../../api/purchases';
import { getSettings } from '../../../api/settings';
import { apiErrorMessage } from '../../../api/errors';
import { bookIntentLabel, loadBookIntent } from '../../../lib/bookIntent';
import FrontPageHeader from '../../../components/member/FrontPageHeader';
import FrontCard from '../../../components/member/FrontCard';
import { PlanCard } from './components/PlanCard';
import { OrderSheet } from './components/OrderSheet';
import { MEMBER_CATEGORY_LABEL, fitsIntent } from './lib';

type Filter = '全部' | ProductCategory;
const CATEGORY_ORDER: ProductCategory[] = ['團體課程', '課程', '用品'];

/**
 * 購買方案（前台）：方案卡片 → 底部面板選數量 → 送出訂單（待付款）→ 顯示付款方式說明。
 * 從預約頁過來（?from=book）時，標出能用來預約那堂課的方案並排在最前面；
 * 收款後回到預約頁會直接打開那堂課（lib/bookIntent.ts）。金額一律由後端計算。
 */
export default function BuyProduct() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const intent = params.get('from') === 'book' ? loadBookIntent() : null;

  const [filter, setFilter] = useState<Filter>('全部');
  const [selected, setSelected] = useState<Product | null>(null);
  const [order, setOrder] = useState<Purchase | null>(null);

  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const { data: courses = [] } = useQuery({ queryKey: ['courses'], queryFn: listCourses });
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSettings });
  const { data: purchases = [] } = useQuery({ queryKey: ['my-purchases'], queryFn: () => listPurchases() });

  const courseName = useMemo(() => new Map(courses.map((c) => [c.id, c.name])), [courses]);
  const nameOf = (p: Product) => (p.course_id != null ? courseName.get(p.course_id) : undefined);
  const unpaidCount = purchases.filter((p) => p.payment_status === '待付款').length;

  const active = (products ?? []).filter((p) => p.is_active);
  const categories = CATEGORY_ORDER.filter((c) => active.some((p) => p.category === c));
  const visible = active
    .filter((p) => filter === '全部' || p.category === filter)
    .sort((a, b) => {
      // 適用想預約那堂課的排最前面，其餘依分類、價格
      const fit = Number(fitsIntent(b, intent)) - Number(fitsIntent(a, intent));
      if (fit) return fit;
      const cat = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
      return cat || a.price - b.price;
    });

  const buy = useMutation({
    mutationFn: ({
      product,
      quantity,
      coupon,
    }: {
      product: Product;
      quantity: number;
      coupon: { member_coupon_id?: number; coupon_code?: string };
    }) => createSelfPurchase({ product_id: product.id, quantity, ...coupon }),
    onSuccess: (created) => {
      setOrder(created);
      queryClient.invalidateQueries({ queryKey: ['my-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['my-coupons'] });
      queryClient.invalidateQueries({ queryKey: ['coupons-usable'] });
    },
    onError: (err) => message.error(apiErrorMessage(err, '購買失敗，請稍後再試')),
  });

  const closeSheet = () => {
    setSelected(null);
    setOrder(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FrontPageHeader title="購買方案" />

      {intent && (
        <FrontCard highlighted>
          <div style={{ fontSize: 13, color: token.colorTextSecondary }}>想預約</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{bookIntentLabel(intent)}</div>
          <div style={{ fontSize: 13, color: token.colorTextSecondary, marginTop: 4 }}>
            標示「適用這堂課」的方案可以用來預約；確認收款後回到預約課程就能直接預約。
          </div>
        </FrontCard>
      )}

      {unpaidCount > 0 && (
        <FrontCard style={{ fontSize: 14 }}>
          你有 {unpaidCount} 筆待付款的訂單，
          <Link to="/member/products">查看付款方式</Link>
        </FrontCard>
      )}

      {categories.length > 1 && (
        <Segmented<Filter>
          block
          value={filter}
          onChange={setFilter}
          options={[
            { value: '全部', label: '全部' },
            ...categories.map((c) => ({ value: c, label: MEMBER_CATEGORY_LABEL[c] })),
          ]}
        />
      )}

      {isLoading ? (
        <FrontCard>
          <Skeleton active />
        </FrontCard>
      ) : visible.length === 0 ? (
        <FrontCard style={{ textAlign: 'center', padding: 24, color: token.colorTextSecondary }}>
          目前沒有可購買的方案，請洽櫃台
        </FrontCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((p) => (
            <PlanCard
              key={p.id}
              product={p}
              courseName={nameOf(p)}
              recommended={fitsIntent(p, intent)}
              onSelect={() => {
                setOrder(null);
                setSelected(p);
              }}
            />
          ))}
        </div>
      )}

      <OrderSheet
        product={selected}
        courseName={selected ? nameOf(selected) : undefined}
        order={order}
        paymentInstructions={settings?.payment_instructions ?? null}
        intentLabel={intent && selected && fitsIntent(selected, intent) ? bookIntentLabel(intent) : null}
        submitting={buy.isPending}
        onSubmit={(quantity, coupon) => selected && buy.mutate({ product: selected, quantity, coupon })}
        onClose={closeSheet}
        onViewOrders={() => navigate('/member/products')}
      />
    </div>
  );
}

import { useState } from 'react';
import { App, Button, Empty, Input, Segmented, Skeleton, Space, Tag, theme } from 'antd';
import { GiftOutlined, TagOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { claimCoupon, listMyCoupons, redeemTrialCoupon, type MemberCoupon } from '../../api/coupons';
import { listProducts } from '../../api/products';
import { apiErrorMessage } from '../../api/errors';
import { formatServerTime } from '../../lib/datetime';
import FrontPageHeader from '../../components/member/FrontPageHeader';
import FrontCard from '../../components/member/FrontCard';
import { useTerms } from '../../lib/terms';

type Tab = '可使用' | '已使用／過期';

/**
 * 我的優惠券（ADR 0010）：輸入公開代碼領取、查看手上的券。
 * 體驗券按「使用並預約」換成堂數後直接去預約；折價券在購買方案時選用。
 */
export default function MyCoupons() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { t } = useTerms();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('可使用');
  const [code, setCode] = useState('');

  const { data: coupons = [], isLoading } = useQuery({ queryKey: ['my-coupons'], queryFn: listMyCoupons });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const available = coupons.filter((c) => c.status === '可使用');
  const past = coupons.filter((c) => c.status !== '可使用');
  const shown = tab === '可使用' ? available : past;

  const claim = useMutation({
    mutationFn: () => claimCoupon(code.trim()),
    onSuccess: (c) => {
      message.success(`已領取「${c.name}」`);
      setCode('');
      setTab('可使用');
      queryClient.invalidateQueries({ queryKey: ['my-coupons'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });
  const redeem = useMutation({
    mutationFn: (c: MemberCoupon) => redeemTrialCoupon(c.id),
    onSuccess: (p) => {
      message.success(`已加入 ${p.total_hours} ${t.unit}，挑個時段預約吧`);
      queryClient.invalidateQueries({ queryKey: ['my-coupons'] });
      queryClient.invalidateQueries({ queryKey: ['my-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      // 團體課程的體驗券到團體課；其他（私人課）直接切到私人課
      const isGroup = products.find((x) => x.id === p.product_id)?.category === '團體課程';
      navigate(isGroup ? '/member/book' : '/member/book?tab=私人課');
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const expiryText = (c: MemberCoupon) => {
    if (c.status === '已使用') return c.used_at ? `已於 ${formatServerTime(c.used_at, 'M/D')} 使用` : '已使用';
    if (!c.expires_on) return '沒有使用期限';
    const d = dayjs(c.expires_on);
    return c.status === '已過期' ? `${d.format('M/D')} 已過期` : `${d.format('YYYY/M/D')} 前有效`;
  };

  const card = (c: MemberCoupon) => {
    const isTrial = c.kind === '體驗券';
    const active = c.status === '可使用';
    const accent = isTrial ? token.purple6 : token.orange6;
    return (
      <FrontCard key={c.id} padding={0} style={{ display: 'flex', overflow: 'hidden', opacity: active ? 1 : 0.6 }}>
        <div
          aria-hidden
          style={{
            width: 64,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isTrial ? token.purple1 : token.orange1,
            color: accent,
            fontSize: 26,
          }}
        >
          {isTrial ? <GiftOutlined /> : <TagOutlined />}
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</span>
            {!active && <Tag style={{ marginInlineEnd: 0 }}>{c.status}</Tag>}
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: accent }}>{c.summary}</span>
          {c.description && <span style={{ fontSize: 13, color: token.colorTextSecondary }}>{c.description}</span>}
          <span style={{ fontSize: 12, color: token.colorTextTertiary }}>{expiryText(c)}</span>
          {active && (
            <div style={{ marginTop: 8 }}>
              {isTrial ? (
                <Button type="primary" loading={redeem.isPending && redeem.variables?.id === c.id} onClick={() => redeem.mutate(c)}>
                  使用並預約
                </Button>
              ) : (
                <Button onClick={() => navigate('/member/purchase')}>去購買方案</Button>
              )}
            </div>
          )}
        </div>
      </FrontCard>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FrontPageHeader title="我的優惠券" />

      <FrontCard>
        <label htmlFor="claim-code" style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          有優惠代碼嗎？
        </label>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            id="claim-code"
            size="large"
            placeholder="輸入代碼，例如 WELCOME300"
            value={code}
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value)}
            onPressEnter={() => code.trim() && claim.mutate()}
          />
          <Button size="large" type="primary" disabled={!code.trim()} loading={claim.isPending} onClick={() => claim.mutate()}>
            領取
          </Button>
        </Space.Compact>
      </FrontCard>

      <Segmented<Tab>
        block
        value={tab}
        onChange={setTab}
        options={[
          { value: '可使用', label: `可使用 ${available.length}` },
          { value: '已使用／過期', label: `已使用／過期 ${past.length}` },
        ]}
      />

      {isLoading ? (
        <FrontCard>
          <Skeleton active />
        </FrontCard>
      ) : shown.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{shown.map(card)}</div>
      ) : (
        <FrontCard>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={tab === '可使用' ? '目前沒有可以用的優惠券' : '還沒有用過的優惠券'}
          />
        </FrontCard>
      )}
    </div>
  );
}

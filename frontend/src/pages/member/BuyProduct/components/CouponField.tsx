import { useState } from 'react';
import { Button, Input, Select, Space, theme } from 'antd';
import type { UsableCoupon } from '../../../../api/coupons';
import { formatPrice } from '../lib';

/** 結帳時選的優惠券：不使用／「我的優惠券」裡的一張／輸入公開代碼 */
export type CouponChoice = { type: 'none' } | { type: 'wallet'; id: number } | { type: 'code'; code: string | null };

export interface CouponFieldProps {
  usable: UsableCoupon[];
  value: CouponChoice;
  onChange: (value: CouponChoice) => void;
  /** 代碼試算失敗的原因 */
  error?: string | null;
}

/** 購買方案時的優惠券欄位：預設帶入最划算的一張，不能用的列出原因 */
export function CouponField({ usable, value, onChange, error }: CouponFieldProps) {
  const { token } = theme.useToken();
  const [codeInput, setCodeInput] = useState(value.type === 'code' ? (value.code ?? '') : '');
  const selectValue = value.type === 'wallet' ? `mc:${value.id}` : value.type;
  const usableCount = usable.filter((u) => u.usable).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <Select
        id="order-coupon"
        value={selectValue}
        style={{ width: '100%' }}
        onChange={(v: string) => {
          if (v === 'none') onChange({ type: 'none' });
          else if (v === 'code') onChange({ type: 'code', code: null });
          else onChange({ type: 'wallet', id: Number(v.slice(3)) });
        }}
        options={[
          { value: 'none', label: usableCount ? '不使用優惠券' : '沒有可用的優惠券' },
          ...usable.map((u) => ({
            value: `mc:${u.member_coupon.id}`,
            disabled: !u.usable,
            label: u.usable
              ? `${u.member_coupon.name}（−${formatPrice(u.discount)}）`
              : `${u.member_coupon.name}（${u.reason}）`,
          })),
          { value: 'code', label: '輸入優惠代碼…' },
        ]}
      />
      {value.type === 'code' && (
        <Space.Compact style={{ width: '100%' }}>
          <Input
            aria-label="優惠代碼"
            placeholder="例如 WELCOME300"
            value={codeInput}
            autoCapitalize="characters"
            onChange={(e) => setCodeInput(e.target.value)}
            onPressEnter={() => onChange({ type: 'code', code: codeInput.trim() || null })}
          />
          <Button disabled={!codeInput.trim()} onClick={() => onChange({ type: 'code', code: codeInput.trim() })}>
            套用
          </Button>
        </Space.Compact>
      )}
      {error && <div style={{ fontSize: 13, color: token.colorError }}>{error}</div>}
    </div>
  );
}

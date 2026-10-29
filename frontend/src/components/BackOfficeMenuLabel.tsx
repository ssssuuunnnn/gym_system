import { useState, type ReactNode } from 'react';
import { Badge, Tooltip, theme } from 'antd';
import { PushpinFilled, PushpinOutlined } from '@ant-design/icons';

export interface BackOfficeMenuLabelProps {
  label: ReactNode;
  /** 數字徽章（例如新詢問數）；0 或未給不顯示 */
  badge?: number;
  /** 有給才顯示釘選按鈕 */
  onTogglePin?: () => void;
  pinned?: boolean;
  /** 側欄收成圖示時的彈出選單：只放名稱與徽章，不佔滿整列、不顯示釘選 */
  compact?: boolean;
}

/**
 * 後台側欄的選單文字：名稱＋數字徽章＋釘選按鈕。
 * 釘選按鈕平常隱藏，滑過或鍵盤移到這一列才出現；已釘選的一律顯示實心圖釘。
 */
export function BackOfficeMenuLabel({ label, badge, onTogglePin, pinned = false, compact = false }: BackOfficeMenuLabelProps) {
  const { token } = theme.useToken();
  const [active, setActive] = useState(false);
  const text = typeof label === 'string' ? label : '';

  if (compact) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {label}
        {badge ? <Badge count={badge} size="small" aria-label={`${badge} 筆新項目`} /> : null}
      </span>
    );
  }

  return (
    <span
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {badge ? <Badge count={badge} size="small" aria-label={`${badge} 筆新項目`} /> : null}
      {onTogglePin && (
        <Tooltip title={pinned ? '取消釘選' : '釘選到最上方'} placement="right" mouseEnterDelay={0.4}>
          <button
            type="button"
            aria-label={pinned ? `取消釘選「${text}」` : `釘選「${text}」`}
            aria-pressed={pinned}
            onClick={(e) => {
              // 不要觸發選單項目的換頁
              e.stopPropagation();
              onTogglePin();
            }}
            onKeyDown={(e) => e.stopPropagation()}
            onFocus={() => setActive(true)}
            onBlur={() => setActive(false)}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              padding: 0,
              border: 'none',
              borderRadius: token.borderRadiusSM,
              background: 'transparent',
              cursor: 'pointer',
              color: pinned ? token.colorPrimary : token.colorTextTertiary,
              opacity: pinned || active ? 1 : 0,
              transition: 'opacity .15s',
            }}
          >
            {pinned ? <PushpinFilled /> : <PushpinOutlined />}
          </button>
        </Tooltip>
      )}
    </span>
  );
}

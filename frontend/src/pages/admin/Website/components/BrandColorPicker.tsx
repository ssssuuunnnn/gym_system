import { useEffect, useState } from 'react';
import { Alert, Button, ColorPicker, Flex, Input, Space, Typography, theme } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { BRAND_COLORS } from '../../../../api/website';
import { checkBrandColor, MIN_BRAND_CONTRAST, normalizeHex } from '../../../../lib/brandColor';

export interface BrandColorPickerProps {
  /** 目前的品牌色（預設色或自訂的 #RRGGBB） */
  value: string;
  /** 只在顏色合格（對比夠）時呼叫 */
  onChange: (hex: string) => void;
}

const isPreset = (hex: string) => BRAND_COLORS.some((c) => c.hex === hex);

/**
 * 品牌色：5 個預設色，或自訂 Hex 色碼（色盤或直接輸入）。自訂色要通過對比檢查才會套用；
 * 太淺時提示對比數字，並提供同色相調深後的建議色。後端存檔時會再檢查一次（app/core/colors.py）。
 */
export function BrandColorPicker({ value, onChange }: BrandColorPickerProps) {
  const { token } = theme.useToken();
  const [custom, setCustom] = useState(() => (isPreset(value) ? '' : value));
  const [customOpen, setCustomOpen] = useState(() => !isPreset(value));

  // 外部換掉內容（例如捨棄草稿）時同步；正在輸入的同一個顏色（如 #abc ↔ #AABBCC）不覆蓋
  useEffect(() => {
    if (!isPreset(value)) {
      setCustom((prev) => (normalizeHex(prev) === value ? prev : value));
      setCustomOpen(true);
    }
  }, [value]);

  const check = checkBrandColor(custom);
  const applyCustom = (text: string) => {
    setCustom(text);
    const result = checkBrandColor(text);
    if (result.ok && result.hex) onChange(result.hex);
  };

  const swatch = (hex: string, label: string, selected: boolean, onClick: () => void) => (
    <Button
      key={label}
      shape="circle"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onClick}
      icon={selected ? <CheckOutlined style={{ color: token.colorWhite }} /> : undefined}
      style={{
        width: 40,
        height: 40,
        background: hex,
        borderColor: selected ? token.colorPrimaryBorder : hex,
        boxShadow: selected ? `0 0 0 3px ${token.colorPrimaryBorder}` : 'none',
      }}
    />
  );

  const customSelected = !isPreset(value);

  return (
    <Flex vertical gap={12}>
      <Space wrap>
        {BRAND_COLORS.map((c) =>
          swatch(c.hex, c.name, value === c.hex, () => {
            onChange(c.hex);
            setCustomOpen(false);
          }),
        )}
        <Button
          aria-pressed={customSelected}
          onClick={() => {
            setCustomOpen(true);
            if (!custom) setCustom(value);
          }}
          style={customSelected ? { borderColor: token.colorPrimary, color: token.colorPrimary } : undefined}
        >
          {customSelected && <CheckOutlined />}自訂色碼
        </Button>
      </Space>

      {customOpen && (
        <Flex vertical gap={8} style={{ maxWidth: 420 }}>
          <Flex gap={8} align="center">
            <ColorPicker
              value={check.hex ?? value}
              disabledAlpha
              format="hex"
              onChange={(color) => applyCustom(color.toHexString())}
              aria-label="選擇顏色"
            />
            <Input
              id="site-brand-hex"
              aria-label="Hex 色碼"
              value={custom}
              maxLength={7}
              placeholder="#C3400D"
              onChange={(e) => applyCustom(e.target.value)}
              status={custom && !check.ok ? 'error' : undefined}
              style={{ width: 140, fontFamily: token.fontFamilyCode }}
            />
            {check.ok && check.ratio !== null && (
              <Typography.Text type="success">已套用・對比 {check.ratio.toFixed(1)}:1</Typography.Text>
            )}
          </Flex>
          {custom && !check.hex && (
            <Typography.Text type="danger">請輸入 6 碼色碼，例如 #C3400D</Typography.Text>
          )}
          {check.hex && !check.ok && check.ratio !== null && (
            <Alert
              type="warning"
              showIcon
              title={`這個顏色太淺，按鈕的白字和淺色底上的文字會看不清楚（對比 ${check.ratio.toFixed(1)}:1，至少要 ${MIN_BRAND_CONTRAST}:1），還沒套用`}
              action={
                check.suggestion && (
                  <Button size="small" onClick={() => applyCustom(check.suggestion!)}>
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: check.suggestion,
                        marginInlineEnd: 6,
                        verticalAlign: -1,
                      }}
                    />
                    改用 {check.suggestion}
                  </Button>
                )
              }
            />
          )}
        </Flex>
      )}
    </Flex>
  );
}

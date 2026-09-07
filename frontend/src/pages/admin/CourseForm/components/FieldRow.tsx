import type { CSSProperties, ReactNode } from 'react';
import { theme } from 'antd';

/**
 * 「課程資訊」卡片內共用的水平欄位列：右對齊標籤 + 內容，必填標紅星。
 * 對應 Claude Design 稿的 `width:88;text-align:right` 標籤欄。
 */
export interface FieldRowProps {
  label: string;
  required?: boolean;
  /** 內容較高時（textarea / 上傳區）標籤靠上對齊 */
  alignTop?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

export function FieldRow({ label, required = false, alignTop = false, children, style }: FieldRowProps) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: alignTop ? 'flex-start' : 'center',
        gap: 12,
        ...style,
      }}
    >
      <div
        style={{
          width: 88,
          flex: 'none',
          textAlign: 'right',
          fontSize: 14,
          color: token.colorText,
          paddingTop: alignTop ? 6 : 0,
        }}
      >
        {required && <span style={{ color: token.colorError, marginRight: 4 }}>*</span>}
        {label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

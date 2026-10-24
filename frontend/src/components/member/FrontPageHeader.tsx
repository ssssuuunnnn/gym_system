import { theme } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

export interface FrontPageHeaderProps {
  /** 頁面大標 */
  title: ReactNode;
  /** 標題上方的小字（例如今天日期） */
  eyebrow?: ReactNode;
  /** 右側動作（圖示按鈕、頭像） */
  extra?: ReactNode;
  style?: CSSProperties;
}

/** 前台頁首：小字＋大標，右側可放動作。前台各頁共用。 */
export default function FrontPageHeader({ title, eyebrow, extra, style }: FrontPageHeaderProps) {
  const { token } = theme.useToken();
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52, ...style }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {eyebrow && <p style={{ margin: 0, fontSize: 13, color: token.colorTextSecondary }}>{eyebrow}</p>}
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.3 }}>{title}</h1>
      </div>
      {extra}
    </header>
  );
}

import { theme } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

export interface FrontCardProps {
  children: ReactNode;
  /** 以主題色外框標示（例如「下一堂」「上課中」） */
  highlighted?: boolean;
  /** 內距，預設 16 */
  padding?: number | string;
  as?: 'div' | 'section' | 'article';
  'aria-label'?: string;
  style?: CSSProperties;
}

/** 前台白底圓角卡片：無邊框、無陰影，靠底色分層。前台各頁共用。 */
export default function FrontCard({ children, highlighted, padding = 16, as = 'div', style, ...rest }: FrontCardProps) {
  const { token } = theme.useToken();
  const Tag = as;
  return (
    <Tag
      aria-label={rest['aria-label']}
      style={{
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        padding,
        boxShadow: highlighted ? `0 0 0 2px ${token.colorPrimary}` : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

import { theme } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';

export interface CoverTileProps {
  /** 課程封面網址；沒有時顯示主題色圖示方塊 */
  src?: string | null;
  /** 邊長（px），預設 72 */
  size?: number;
  style?: CSSProperties;
}

/** 課程封面縮圖：有封面顯示圖片，否則以主題淺底＋圖示代替。純裝飾，讀屏略過。 */
export default function CoverTile({ src, size = 72, style }: CoverTileProps) {
  const { token } = theme.useToken();
  const box: CSSProperties = {
    width: size,
    height: size,
    flex: 'none',
    borderRadius: token.borderRadius,
    ...style,
  };
  if (src) return <img src={src} alt="" style={{ ...box, objectFit: 'cover', display: 'block' }} />;
  return (
    <div
      aria-hidden="true"
      style={{
        ...box,
        background: token.colorPrimaryBg,
        color: token.colorPrimary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.4),
      }}
    >
      <ThunderboltOutlined />
    </div>
  );
}

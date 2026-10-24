import { useEffect, useState } from 'react';
import { Card, Segmented, Spin, Typography, theme } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getWebsitePreviewToken } from '../../../../api/website';

type Device = '桌機' | '手機';

export interface PreviewPaneProps {
  /** 每次存草稿後遞增，讓預覽重新載入 */
  version: number;
  /** 段落 id，預覽載入後捲到正在編輯的段落 */
  anchor?: string;
}

/** 右側預覽：iframe 載入伺服器實際產生的草稿頁面（與上線後一致）。 */
export function PreviewPane({ version, anchor }: PreviewPaneProps) {
  const { token } = theme.useToken();
  const [device, setDevice] = useState<Device>('桌機');
  // token 30 分鐘有效；每次重新載入預覽都換一個新的
  const { data } = useQuery({
    queryKey: ['website-preview-token', version],
    queryFn: getWebsitePreviewToken,
    staleTime: 20 * 60 * 1000,
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => setLoading(true), [data?.token]);

  const width = device === '桌機' ? 1280 : 390;
  const frameWidth = device === '桌機' ? 420 : 300;
  const scale = frameWidth / width;
  const frameHeight = 640;
  const src = data ? `/site/preview?token=${encodeURIComponent(data.token)}${anchor ? `#${anchor}` : ''}` : undefined;

  return (
    <Card
      title="預覽（已儲存的草稿）"
      size="small"
      extra={<Segmented<Device> size="small" value={device} onChange={setDevice} options={['桌機', '手機']} />}
    >
      <div
        style={{
          width: frameWidth,
          maxWidth: '100%',
          height: frameHeight,
          margin: '0 auto',
          overflow: 'hidden',
          position: 'relative',
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          background: token.colorBgLayout,
        }}
      >
        {src && (
          <iframe
            key={`${src}-${device}`}
            title="形象網站預覽"
            src={src}
            onLoad={() => setLoading(false)}
            style={{
              width,
              height: frameHeight / scale,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
              background: token.colorBgContainer,
            }}
          />
        )}
        {(loading || !src) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin />
          </div>
        )}
      </div>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
        預覽是伺服器實際產生的頁面；按「儲存草稿」後更新。訪客在你按「發布到網站」之前看不到草稿。
      </Typography.Paragraph>
    </Card>
  );
}

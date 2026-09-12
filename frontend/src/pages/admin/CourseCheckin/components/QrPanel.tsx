import { useEffect, useRef } from 'react';
import { Typography } from 'antd';
import { buildQrSeed, drawPseudoQR } from '../../../../lib/pseudoQr';
import type { SessionKey } from '../../../../api/checkin';

/** 現場報到 QR Code 面板：每 30 秒重繪一次（純視覺展示，非真實可掃描條碼，見 lib/pseudoQr.ts）。 */
export default function QrPanel({ courseId, bookingDate, startHour }: SessionKey) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const redraw = () => {
      if (canvasRef.current) {
        drawPseudoQR(canvasRef.current, buildQrSeed(courseId, bookingDate, startHour));
      }
    };
    redraw();
    const timer = setInterval(redraw, 30000);
    return () => clearInterval(timer);
  }, [courseId, bookingDate, startHour]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <Typography.Text strong style={{ fontSize: 13, alignSelf: 'flex-start' }}>
        現場報到 QR Code
      </Typography.Text>
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          borderRadius: 8,
          border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <canvas ref={canvasRef} width={220} height={220} />
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
        請學員以「我的報到」頁面掃描此 QR Code 完成報到，每 30 秒自動更新
      </Typography.Text>
    </div>
  );
}

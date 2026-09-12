import { useEffect, useRef } from 'react';
import { buildQrSeed, drawPseudoQR } from '../../../../lib/pseudoQr';
import type { CheckinSessionSummary } from '../../../../api/checkin';

interface PrintQrSheetProps {
  session: CheckinSessionSummary;
}

/** 列印用 QR Code 內容（裝飾用途，非真實可掃描條碼，見 lib/pseudoQr.ts）。 */
export default function PrintQrSheet({ session }: PrintQrSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      drawPseudoQR(
        canvasRef.current,
        buildQrSeed(session.course_id, session.booking_date, session.start_hour),
      );
    }
  }, [session]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 40,
        color: '#000',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700 }}>{session.course_name}</div>
      <div style={{ fontSize: 15 }}>
        {session.booking_date} {String(session.start_hour).padStart(2, '0')}:00 · {session.coach_name}
      </div>
      <canvas ref={canvasRef} width={360} height={360} />
      <div style={{ fontSize: 14 }}>請使用「我的報到」頁面掃描此 QR Code 完成報到</div>
    </div>
  );
}

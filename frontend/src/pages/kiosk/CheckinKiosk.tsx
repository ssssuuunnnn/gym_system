import { useEffect, useRef, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar, Tag, Typography, message } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPublicRoster, publicCheckIn, type SessionKey } from '../../api/checkin';
import { buildQrSeed, drawPseudoQR } from '../../lib/pseudoQr';

const POLL_MS = 5000;

/**
 * 第二螢幕看板（免登入）：QR 看板 / 名單看板，供店內平板或第二螢幕開啟。
 * 不套用 AppLayout（無側欄／無登入），僅讀取 URL 參數識別要顯示哪一堂課。
 */
export default function CheckinKiosk() {
  const [params] = useSearchParams();
  const mode = params.get('mode') === 'roster' ? 'roster' : 'qr';
  const courseId = Number(params.get('course_id'));
  const bookingDate = params.get('booking_date') ?? '';
  const startHour = Number(params.get('start_hour'));
  const sessionKey: SessionKey = { courseId, bookingDate, startHour };
  const validSession = Number.isFinite(courseId) && !!bookingDate && Number.isFinite(startHour);

  const queryClient = useQueryClient();
  const { data: roster } = useQuery({
    queryKey: ['public-checkin-roster', sessionKey],
    queryFn: () => getPublicRoster(sessionKey),
    enabled: validSession,
    refetchInterval: POLL_MS,
  });

  const checkInMutation = useMutation({
    mutationFn: (reservationId: number) => publicCheckIn(sessionKey, reservationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-checkin-roster', sessionKey] });
    },
    onError: () => message.error('報到失敗，請洽現場工作人員'),
  });

  if (!validSession) {
    return (
      <div style={kioskWrapStyle('#0b0f14')}>
        <Typography.Text style={{ color: '#fff' }}>看板網址無效，請至課程報到頁重新開啟</Typography.Text>
      </div>
    );
  }

  return mode === 'qr' ? (
    <QrBoard sessionKey={sessionKey} checkedCount={roster?.checked_in_count ?? 0} total={roster?.total_count ?? 0} />
  ) : (
    <RosterBoard
      courseName={roster?.session.course_name ?? ''}
      startHour={startHour}
      checkedCount={roster?.checked_in_count ?? 0}
      total={roster?.total_count ?? 0}
      entries={roster?.entries ?? []}
      onTap={(id) => checkInMutation.mutate(id)}
    />
  );
}

function kioskWrapStyle(background: string): CSSProperties {
  return {
    minHeight: '100vh',
    background,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  };
}

function ExitLink() {
  return (
    <div
      onClick={() => window.close()}
      style={{
        position: 'absolute',
        top: 24,
        right: 24,
        color: 'inherit',
        fontSize: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        opacity: 0.7,
        cursor: 'pointer',
      }}
    >
      <CloseOutlined /> 結束看板模式
    </div>
  );
}

function QrBoard({
  sessionKey,
  checkedCount,
  total,
}: {
  sessionKey: SessionKey;
  checkedCount: number;
  total: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const redraw = () => {
      if (canvasRef.current) {
        drawPseudoQR(canvasRef.current, buildQrSeed(sessionKey.courseId, sessionKey.bookingDate, sessionKey.startHour));
      }
    };
    redraw();
    const timer = setInterval(redraw, 30000);
    return () => clearInterval(timer);
  }, [sessionKey]);

  return (
    <div style={{ ...kioskWrapStyle('#0b0f14'), padding: 40, position: 'relative' }}>
      <ExitLink />
      <div
        style={{
          width: 420,
          height: 420,
          borderRadius: 12,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <canvas ref={canvasRef} width={380} height={380} />
      </div>
      <Typography.Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>
        請使用「我的報到」頁面掃描此 QR Code
      </Typography.Text>
      <Typography.Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
        已報到 {checkedCount} / {total} 人 · 每 30 秒自動更新
      </Typography.Text>
    </div>
  );
}

function RosterBoard({
  courseName,
  startHour,
  checkedCount,
  total,
  entries,
  onTap,
}: {
  courseName: string;
  startHour: number;
  checkedCount: number;
  total: number;
  entries: { reservation_id: number; display_name: string; checked_in: boolean; checked_in_at: string | null }[];
  onTap: (reservationId: number) => void;
}) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: 32, boxSizing: 'border-box', position: 'relative' }}>
      <ExitLink />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBottom: 16 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          {courseName} · {String(startHour).padStart(2, '0')}:00
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 15 }}>
          請點選您的姓名完成報到 · 已報到 {checkedCount} / {total} 人
        </Typography.Text>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14,
          maxWidth: 1080,
          margin: '0 auto',
        }}
      >
        {entries.map((e) => (
          <div
            key={e.reservation_id}
            onClick={() => !e.checked_in && onTap(e.reservation_id)}
            style={{
              cursor: e.checked_in ? 'default' : 'pointer',
              background: '#fff',
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              padding: '20px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              textAlign: 'center',
            }}
          >
            <Avatar size={48}>{e.display_name.charAt(0)}</Avatar>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{e.display_name}</div>
            <Tag color={e.checked_in ? 'success' : 'default'}>{e.checked_in ? '已報到' : '未報到'}</Tag>
            {e.checked_in && e.checked_in_at && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(e.checked_in_at).toTimeString().slice(0, 5)}
              </Typography.Text>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

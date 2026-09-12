import { Button, Popover, Space, Typography, message } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import type { SessionKey } from '../../../../api/checkin';

function buildKioskUrl(mode: 'qr' | 'roster', { courseId, bookingDate, startHour }: SessionKey): string {
  const url = new URL('/checkin-kiosk', window.location.origin);
  url.searchParams.set('mode', mode);
  url.searchParams.set('course_id', String(courseId));
  url.searchParams.set('booking_date', bookingDate);
  url.searchParams.set('start_hour', String(startHour));
  return url.toString();
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    message.success('已複製連結');
  } catch {
    message.error('複製失敗，請手動選取網址');
  }
}

interface KioskLinkPopoverProps {
  sessionKey: SessionKey;
}

/** 🔗 第二螢幕看板專屬網址（免登入直接進入看板）。 */
export default function KioskLinkPopover({ sessionKey }: KioskLinkPopoverProps) {
  const qrUrl = buildKioskUrl('qr', sessionKey);
  const rosterUrl = buildKioskUrl('roster', sessionKey);

  return (
    <Popover
      trigger="click"
      title="專屬網址（免登入直接進入看板）"
      content={
        <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              QR 看板
            </Typography.Text>
            <Space.Compact style={{ width: '100%' }}>
              <input
                readOnly
                value={qrUrl}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  padding: '6px 8px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px 0 0 6px',
                }}
              />
              <Button size="small" onClick={() => copyToClipboard(qrUrl)}>
                複製
              </Button>
            </Space.Compact>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              名單看板
            </Typography.Text>
            <Space.Compact style={{ width: '100%' }}>
              <input
                readOnly
                value={rosterUrl}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  padding: '6px 8px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px 0 0 6px',
                }}
              />
              <Button size="small" onClick={() => copyToClipboard(rosterUrl)}>
                複製
              </Button>
            </Space.Compact>
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            切換課程後網址會更新，貼給第二螢幕裝置即可直接開啟，不需登入
          </Typography.Text>
        </div>
      }
    >
      <Button icon={<LinkOutlined />} />
    </Popover>
  );
}

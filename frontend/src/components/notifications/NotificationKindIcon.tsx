import { CalendarOutlined, CloseCircleOutlined, DollarOutlined, MessageOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import type { StaffNotificationKind } from '../../api/notifications';

export interface NotificationKindIconProps {
  kind: StaffNotificationKind;
  /** 圓形底的直徑 */
  size?: number;
}

/** 通知種類的圖示：圓形淡色底＋對應顏色的圖示（鈴鐺列表與 toast 共用） */
export function NotificationKindIcon({ kind, size = 32 }: NotificationKindIconProps) {
  const { token } = theme.useToken();
  const meta: Record<StaffNotificationKind, { icon: React.ReactNode; color: string; bg: string }> = {
    新預約: { icon: <CalendarOutlined />, color: token.colorPrimary, bg: token.colorPrimaryBg },
    會員取消預約: { icon: <CloseCircleOutlined />, color: token.colorWarning, bg: token.colorWarningBg },
    新訂單: { icon: <DollarOutlined />, color: token.colorSuccess, bg: token.colorSuccessBg },
    新詢問: { icon: <MessageOutlined />, color: token.purple6, bg: token.purple1 },
  };
  const m = meta[kind];
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: m.bg,
        color: m.color,
        fontSize: size * 0.5,
      }}
    >
      {m.icon}
    </span>
  );
}

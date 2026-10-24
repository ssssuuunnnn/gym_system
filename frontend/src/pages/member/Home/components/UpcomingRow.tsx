import { Tag, theme } from 'antd';
import { Link } from 'react-router-dom';
import type { Reservation } from '../../../../api/reservations';
import type { ReservationInfo } from '../../../../lib/useBookingLookups';
import { classStart } from '../../../../lib/booking';
import { isoWeekday } from '../../../../lib/availability';
import { weekdayLabel } from '../../../../lib/weekday';

export interface UpcomingRowProps {
  reservation: Reservation;
  info: ReservationInfo;
}

/** 首頁「接下來」清單的一列：日期方塊、課程、時間與教練、狀態。點擊到我的預約。 */
export function UpcomingRow({ reservation: r, info }: UpcomingRowProps) {
  const { token } = theme.useToken();
  const start = classStart(r);
  return (
    <Link
      to="/member/bookings"
      style={{
        background: token.colorBgContainer,
        borderRadius: 14,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: token.colorText,
        textDecoration: 'none',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          flex: 'none',
          borderRadius: token.borderRadius,
          background: token.colorBgLayout,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>{start.format('D')}</span>
        <span style={{ fontSize: 11, color: token.colorTextSecondary }}>{weekdayLabel(isoWeekday(start))}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 500 }}>{info.title}</span>
        <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
          {start.format('HH:mm')}
          {info.coachName ? ` · ${info.coachName}` : ''}
        </span>
      </div>
      <Tag variant="filled" color={r.status === '已確認' ? 'success' : 'warning'} style={{ marginInlineEnd: 0 }}>
        {r.status}
      </Tag>
    </Link>
  );
}

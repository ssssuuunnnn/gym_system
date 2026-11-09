import type { ReactNode } from 'react';
import { Tag, theme } from 'antd';
import type { Reservation } from '../../../../api/reservations';
import type { ReservationInfo } from '../../../../lib/useBookingLookups';
import { classEnd, classStart } from '../../../../lib/booking';

export interface BookingCardProps {
  reservation: Reservation;
  info: ReservationInfo;
  /** 卡片下方的動作（簽到、取消…），沒有就不顯示 */
  actions?: ReactNode;
}

/** 已取消／已拒絕：淡化、刪除線 */
export function isInactive(r: Reservation) {
  return r.status === '已取消' || r.status === '已拒絕';
}

/**
 * 我的預約的一筆：像行事曆的事件卡片。
 * 已確認＝實心卡片＋左側主題色條；待確認＝虛線框＋斜紋底（還沒成立）；已結束的淡一點；已取消／已拒絕淡化加刪除線。
 */
export function BookingCard({ reservation: r, info, actions }: BookingCardProps) {
  const { token } = theme.useToken();
  const start = classStart(r);
  const end = classEnd(r, info.durationMinutes);
  const pending = r.status === '待確認';
  const inactive = isInactive(r);
  const ended = end.isBefore();

  const statusTag = (() => {
    if (pending) return <Tag color="warning">等待確認</Tag>;
    if (r.status === '已拒絕') return <Tag>未成立</Tag>;
    if (r.status === '已取消') return <Tag>{r.late_cancel ? '已取消・期限內' : '已取消'}</Tag>;
    if (r.attendance === '已出席') return <Tag color="success">已出席</Tag>;
    if (r.attendance === '未到') return <Tag color="error">未到</Tag>;
    if (ended) return <Tag>已結束</Tag>;
    return null;
  })();

  return (
    <article
      aria-label={`${info.title}，${start.format('M 月 D 日 HH:mm')}，${r.status}`}
      style={{
        position: 'relative',
        borderRadius: 12,
        padding: '12px 14px 12px 18px',
        background: pending
          ? `repeating-linear-gradient(135deg, ${token.colorBgContainer} 0 10px, ${token.colorFillQuaternary} 10px 20px)`
          : token.colorBgContainer,
        border: pending ? `1.5px dashed ${token.colorWarningBorder}` : `1px solid ${token.colorBorderSecondary}`,
        opacity: inactive ? 0.6 : ended ? 0.8 : 1,
        overflow: 'hidden',
      }}
    >
      {!pending && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: inactive ? token.colorBorder : token.colorPrimary,
          }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: token.colorText,
              textDecoration: inactive ? 'line-through' : undefined,
              overflowWrap: 'anywhere',
            }}
          >
            {info.title}
          </span>
          <span style={{ fontSize: 15, color: token.colorTextSecondary, fontVariantNumeric: 'tabular-nums' }}>
            {start.format('HH:mm')} – {end.format('HH:mm')}
          </span>
          <span style={{ fontSize: 13, color: token.colorTextTertiary }}>
            {[info.coachName, info.branchName, r.people_count > 1 ? `${r.people_count} 人` : null].filter(Boolean).join('・')}
          </span>
        </div>
        {statusTag && <span style={{ flex: 'none' }}>{statusTag}</span>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>{actions}</div>}
    </article>
  );
}

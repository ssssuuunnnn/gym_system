import { Button, Popconfirm, Tag, theme } from 'antd';
import dayjs from 'dayjs';
import { CheckOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { Reservation } from '../../../../api/reservations';
import type { ReservationInfo } from '../../../../lib/useBookingLookups';
import {
  classStart,
  hasStarted,
  isLateCancel,
  relativeStartLabel,
  selfCheckInOpen,
  selfCheckInOpensAt,
} from '../../../../lib/booking';
import FrontCard from '../../../../components/member/FrontCard';

export interface NextClassCardProps {
  reservation: Reservation;
  info: ReservationInfo;
  /** 取消期限（小時），來自系統設定 */
  deadlineHours: number | undefined;
  onCheckIn: () => void;
  onCancel: () => void;
  checkingIn?: boolean;
  cancelling?: boolean;
}

/** 首頁「下一堂課」：時間、課程、教練；時間到出現大的簽到按鈕，期限內取消會提示不退堂。 */
export function NextClassCard({ reservation: r, info, deadlineHours, onCheckIn, onCancel, checkingIn, cancelling }: NextClassCardProps) {
  const { token } = theme.useToken();
  const start = classStart(r);
  const late = isLateCancel(r, deadlineHours);
  const canCheckIn = r.status === '已確認' && !r.attendance && selfCheckInOpen(r, info.durationMinutes);
  const canCancel = !r.attendance && (r.status === '待確認' || (r.status === '已確認' && !hasStarted(r)));

  return (
    <section aria-labelledby="next-class-title" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 id="next-class-title" style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
          下一堂課
        </h2>
        <Tag variant="filled" style={{ marginInlineEnd: 0, color: token.colorPrimary, background: token.colorPrimaryBg }}>
          {relativeStartLabel(start)}
        </Tag>
      </div>
      <FrontCard style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 64, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{start.format('HH:mm')}</span>
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
              {start.isSame(dayjs(), 'day') ? `${info.durationMinutes} 分鐘` : start.format('MM/DD')}
            </span>
          </div>
          <div style={{ width: 1, height: 40, background: token.colorBorderSecondary }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{info.title}</span>
            <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
              {[info.coachName && `${info.coachName}`, info.isGroup ? '團體課' : '私人課'].filter(Boolean).join(' · ')}
            </span>
          </div>
          {r.status === '待確認' && (
            <Tag variant="filled" color="warning" style={{ marginInlineEnd: 0 }}>
              待確認
            </Tag>
          )}
          {r.attendance && (
            <Tag variant="filled" color={r.attendance === '已出席' ? 'success' : 'error'} style={{ marginInlineEnd: 0 }}>
              {r.attendance === '已出席' ? '已簽到' : '未到'}
            </Tag>
          )}
        </div>

        {(canCheckIn || canCancel || (r.status === '已確認' && !r.attendance)) && (
          <div style={{ display: 'flex', gap: 10 }}>
            {r.status === '已確認' && !r.attendance && (
              <Button
                type="primary"
                size="large"
                icon={canCheckIn ? <CheckOutlined /> : undefined}
                disabled={!canCheckIn}
                loading={checkingIn}
                onClick={onCheckIn}
                style={{ flex: 1, fontWeight: 700 }}
              >
                {canCheckIn ? '簽到' : `${selfCheckInOpensAt(r).format('HH:mm')} 開放簽到`}
              </Button>
            )}
            {canCancel && (
              <Popconfirm
                title="確定要取消這堂課？"
                description={late ? `已在開課前 ${deadlineHours} 小時內，取消後這堂不會退回。` : undefined}
                okText={late ? '仍要取消' : '確定取消'}
                cancelText="不取消"
                onConfirm={onCancel}
              >
                <Button size="large" loading={cancelling} style={{ width: r.status === '已確認' ? 96 : '100%' }}>
                  取消預約
                </Button>
              </Popconfirm>
            )}
          </div>
        )}

        {canCancel && late && (
          <p style={{ margin: 0, fontSize: 12, color: token.colorTextSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
            <InfoCircleOutlined aria-hidden="true" />
            已在開課前 {deadlineHours} 小時內，取消後這堂不會退回
          </p>
        )}
      </FrontCard>
    </section>
  );
}

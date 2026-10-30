import { Button, Popconfirm, Tag, theme } from 'antd';
import { CheckOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import type { Attendance, CoachingReservation } from '../../../../api/reservations';
import { CHECK_IN_OPENS_BEFORE_MINUTES } from '../../../../lib/booking';
import FrontCard from '../../../../components/member/FrontCard';
import { useTerms } from '../../../../lib/terms';

/** 一堂課：團體課＝同課程同日同時段的所有預約；私人課＝一筆預約 */
export interface ClassUnit {
  key: string;
  start: Dayjs;
  end: Dayjs;
  title: string;
  isGroup: boolean;
  branchName: string;
  reservations: CoachingReservation[];
}

export interface ClassUnitCardProps {
  unit: ClassUnit;
  expanded: boolean;
  onToggle: () => void;
  onMark: (reservationId: number, attendance: Attendance) => void;
  /** 正在送出的預約 id */
  markingId?: number;
}

/**
 * 今日課表的一堂課。開放簽到後展開學員名單（簽到／未到，可更正）；
 * 還沒開放時顯示開放時間；全部標記完且下課後收合，點擊可再展開。
 */
export function ClassUnitCard({ unit, expanded, onToggle, onMark, markingId }: ClassUnitCardProps) {
  const { token } = theme.useToken();
  const now = dayjs();
  const { t } = useTerms();
  const opensAt = unit.start.subtract(CHECK_IN_OPENS_BEFORE_MINUTES, 'minute');
  const open = !now.isBefore(opensAt);
  const started = !now.isBefore(unit.start);
  const inProgress = started && now.isBefore(unit.end);
  const attended = unit.reservations.filter((r) => r.attendance === '已出席').length;
  const noShow = unit.reservations.filter((r) => r.attendance === '未到').length;
  const pending = unit.reservations.length - attended - noShow;
  const subtitle = `${
    unit.isGroup ? `${t.group} · ${unit.reservations.length} 位${t.customer}` : `${unit.reservations[0]?.member_username ?? ''} · ${t.private}`
  } · ${unit.branchName}`;

  const summary = !open ? (
    <span style={{ fontSize: 12, color: token.colorTextSecondary, flex: 'none' }}>{opensAt.format('HH:mm')} 開放{t.checkIn}</span>
  ) : inProgress ? (
    <Tag variant="filled" style={{ marginInlineEnd: 0, color: token.colorTextLightSolid, background: token.colorPrimary }}>
      進行中
    </Tag>
  ) : pending > 0 ? (
    <Tag variant="filled" color="warning" style={{ marginInlineEnd: 0 }}>
      {pending} 位待確認
    </Tag>
  ) : (
    <Tag variant="filled" color={noShow ? 'default' : 'success'} style={{ marginInlineEnd: 0 }}>
      {unit.isGroup ? `出席 ${attended}${noShow ? ` · 未到 ${noShow}` : ''}` : noShow ? '未到' : '已出席'}
    </Tag>
  );

  return (
    <FrontCard as="article" highlighted={open && (inProgress || pending > 0)} padding="14px 16px" style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        type="button"
        onClick={open ? onToggle : undefined}
        aria-expanded={open ? expanded : undefined}
        disabled={!open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: 0,
          border: 'none',
          background: 'transparent',
          textAlign: 'left',
          fontFamily: 'inherit',
          color: token.colorText,
          cursor: open ? 'pointer' : 'default',
          minHeight: 44,
        }}
      >
        <span style={{ width: 48, flex: 'none', fontSize: 16, fontWeight: 700, color: inProgress ? token.colorPrimary : token.colorText }}>
          {unit.start.format('HH:mm')}
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{unit.title}</span>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{subtitle}</span>
        </span>
        {summary}
        {open && (expanded ? <UpOutlined aria-hidden="true" style={{ fontSize: 12 }} /> : <DownOutlined aria-hidden="true" style={{ fontSize: 12 }} />)}
      </button>

      {open && expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          {unit.reservations.map((r) => (
            <div
              key={r.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, borderTop: `1px solid ${token.colorBorderSecondary}` }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 36,
                  height: 36,
                  flex: 'none',
                  borderRadius: 18,
                  background: token.colorBgLayout,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {r.member_username.charAt(0).toUpperCase()}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500 }}>
                {r.member_username}
                {r.people_count > 1 && <span style={{ fontSize: 12, color: token.colorTextSecondary }}>（{r.people_count} 人）</span>}
              </span>
              {r.attendance === null ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button type="primary" loading={markingId === r.id} onClick={() => onMark(r.id, '已出席')} style={{ fontWeight: 700 }}>
                    {t.checkIn}
                  </Button>
                  <Popconfirm title={`${r.member_username} 未到？`} description={`未到不退${t.unit}。`} okText="標記未到" cancelText="取消" disabled={!started} onConfirm={() => onMark(r.id, '未到')}>
                    <Button disabled={!started} title={started ? undefined : '開始後才能標記未到'}>
                      未到
                    </Button>
                  </Popconfirm>
                </div>
              ) : r.attendance === '已出席' ? (
                <Popconfirm title="改為未到？" okText="改為未到" cancelText="取消" disabled={!started} onConfirm={() => onMark(r.id, '未到')}>
                  <Button
                    size="small"
                    icon={<CheckOutlined />}
                    aria-label={`${r.member_username} 已${t.checkIn}${started ? '，點一下可更正' : ''}`}
                    style={{ border: 'none', background: token.colorSuccessBg, color: token.colorSuccessText, fontWeight: 500 }}
                  >
                    已{t.checkIn}
                  </Button>
                </Popconfirm>
              ) : (
                <Popconfirm title="改為已出席？" okText="改為已出席" cancelText="取消" onConfirm={() => onMark(r.id, '已出席')}>
                  <Button
                    size="small"
                    aria-label={`${r.member_username} 未到，點一下可更正`}
                    style={{ border: 'none', background: token.colorErrorBg, color: token.colorErrorText, fontWeight: 500 }}
                  >
                    未到
                  </Button>
                </Popconfirm>
              )}
            </div>
          ))}
          <p style={{ margin: 0, padding: '8px 0 0', borderTop: `1px solid ${token.colorBorderSecondary}`, fontSize: 12, color: token.colorTextSecondary }}>
            {t.customer}可在開始前 {CHECK_IN_OPENS_BEFORE_MINUTES} 分鐘自行{t.checkIn}；未到不退{t.unit}
          </p>
        </div>
      )}
    </FrontCard>
  );
}

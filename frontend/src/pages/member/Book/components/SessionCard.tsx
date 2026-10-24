import { Button, Tag, theme } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ScheduleSession } from '../../../../api/courses';
import FrontCard from '../../../../components/member/FrontCard';
import CoverTile from '../../../../components/member/CoverTile';

export interface SessionCardProps {
  session: ScheduleSession;
  /** 目前在確認面板中的這堂 */
  active?: boolean;
  onBook: () => void;
}

/** 預約頁的一堂團體課：封面、課名、時間與教練、名額，右側為預約／已預約／額滿。 */
export function SessionCard({ session: s, active, onBook }: SessionCardProps) {
  const { token } = theme.useToken();
  const start = dayjs(s.session_date).startOf('day').add(s.start_minute, 'minute');
  const end = start.add(s.duration_minutes, 'minute');
  const left = Math.max(s.max_capacity - s.booked_count, 0);
  const full = left === 0;

  return (
    <FrontCard as="article" highlighted={active} padding={12} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <CoverTile src={s.cover_image_url} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{s.course_name}</h3>
        <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
          {start.format('HH:mm')}–{end.format('HH:mm')} · {s.coach_name}
        </span>
        <span style={{ fontSize: 12, fontWeight: left <= 2 && !full ? 500 : 400, color: left <= 2 && !full ? token.colorWarningText : token.colorTextSecondary }}>
          {full ? `${s.max_capacity} / ${s.max_capacity} 人` : left <= 2 ? `剩 ${left} 位` : `${s.booked_count} / ${s.max_capacity} 人`}
        </span>
      </div>
      {s.my_reservation_status ? (
        <Tag
          variant="filled"
          color={s.my_reservation_status === '已確認' ? 'success' : 'warning'}
          icon={s.my_reservation_status === '已確認' ? <CheckOutlined /> : undefined}
          style={{ marginInlineEnd: 0, height: 44, display: 'flex', alignItems: 'center', padding: '0 12px', fontWeight: 700, fontSize: 13 }}
        >
          {s.my_reservation_status === '已確認' ? '已預約' : '待確認'}
        </Tag>
      ) : (
        <Button type={active ? 'primary' : 'default'} disabled={full} onClick={onBook} style={{ width: 72, fontWeight: 700, flex: 'none' }}>
          {full ? '額滿' : '預約'}
        </Button>
      )}
    </FrontCard>
  );
}

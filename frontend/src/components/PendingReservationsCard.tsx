import { Card, Empty, Button } from 'antd';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';

interface PendingReservation {
  id: number;
  member_id: number;
  booking_date: string;
  start_hour: number;
  created_at: string;
}

interface PendingReservationsCardProps {
  reservations: PendingReservation[];
  memberNameById: Map<number, string>;
}

/**
 * 待審核預約卡片：對應設計稿「今日待辦事項」的視覺節奏，
 * 每筆以分隔線區隔，底部顯示總筆數並連結至預約審核列表。
 */
export default function PendingReservationsCard({ reservations, memberNameById }: PendingReservationsCardProps) {
  return (
    <Card title="待審核預約">
      {reservations.length === 0 ? (
        <Empty description="目前沒有待審核預約" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reservations.map((r, i) => (
            <div
              key={r.id}
              style={{
                paddingBottom: 12,
                borderBottom: i < reservations.length - 1 ? '1px solid rgba(5, 5, 5, 0.06)' : 'none',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                {memberNameById.get(r.member_id) ?? `#${r.member_id}`}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.45)' }}>
                預約時段 {dayjs(r.booking_date).format('YYYY-MM-DD')} {r.start_hour}:00
                {' · 提交於 '}
                {dayjs(r.created_at).format('MM/DD HH:mm')}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
            <span style={{ fontSize: 13, color: 'rgba(0, 0, 0, 0.65)' }}>待審核共 {reservations.length} 筆</span>
            <Link to="/admin/reservations">
              <Button type="link" size="small" style={{ padding: 0 }}>
                查看預約審核列表
              </Button>
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

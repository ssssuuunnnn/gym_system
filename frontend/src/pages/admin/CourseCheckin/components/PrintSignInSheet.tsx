import type { CheckinRosterEntry, CheckinSessionSummary } from '../../../../api/checkin';

interface PrintSignInSheetProps {
  session: CheckinSessionSummary;
  entries: CheckinRosterEntry[];
}

/** 列印用簽到表內容（僅結構，顯示／隱藏交由 index.tsx 的列印容器控制）。 */
export default function PrintSignInSheet({ session, entries }: PrintSignInSheetProps) {
  return (
    <div style={{ padding: 24, color: '#000' }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{session.course_name} 簽到表</div>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        {session.booking_date} {String(session.start_hour).padStart(2, '0')}:00 · {session.coach_name} · 共{' '}
        {entries.length} 人
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #000', padding: 8, width: 40 }}>序號</th>
            <th style={{ border: '1px solid #000', padding: 8 }}>會員</th>
            <th style={{ border: '1px solid #000', padding: 8, width: 160 }}>簽名</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={e.id}>
              <td style={{ border: '1px solid #000', padding: 10, textAlign: 'center' }}>{i + 1}</td>
              <td style={{ border: '1px solid #000', padding: 10 }}>{e.username}</td>
              <td style={{ border: '1px solid #000', padding: 10 }}></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

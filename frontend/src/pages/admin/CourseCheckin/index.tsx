import { useEffect, useMemo, useState } from 'react';
import { Breadcrumb, Button, Card, Space, Statistic, Typography, message } from 'antd';
import { PrinterOutlined, QrcodeOutlined, TableOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listUpcomingSessions } from '../../../api/courses';
import { checkIn, getRoster, undoCheckIn } from '../../../api/checkin';
import SessionPicker from './components/SessionPicker';
import { parseSessionOptionValue, sessionOptionValue } from './lib/session';
import RosterPanel from './components/RosterPanel';
import QrPanel from './components/QrPanel';
import PrintSignInSheet from './components/PrintSignInSheet';
import PrintQrSheet from './components/PrintQrSheet';
import KioskLinkPopover from './components/KioskLinkPopover';

type PrintMode = 'sheet' | 'qr' | null;

/**
 * 課程報到（管理員）：依課程掃描／手動標記會員報到，並檢視該課程報到情況。
 * 對應 Claude Design「課程報到掃描」，但 QR 掃描為裝飾用途（本系統無會員端掃描功能，見 lib/pseudoQr.ts）。
 */
export default function CourseCheckin() {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<PrintMode>(null);

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['upcoming-sessions'],
    queryFn: () => listUpcomingSessions(),
  });

  useEffect(() => {
    if (!selection && sessions && sessions.length > 0) {
      setSelection(sessionOptionValue(sessions[0]));
    }
  }, [sessions, selection]);

  const sessionKey = selection ? parseSessionOptionValue(selection) : null;

  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ['checkin-roster', sessionKey],
    queryFn: () => getRoster(sessionKey!),
    enabled: !!sessionKey,
  });

  const checkInMutation = useMutation({
    mutationFn: checkIn,
    onSuccess: (_, id) => {
      const name = roster?.entries.find((e) => e.id === id)?.username ?? '';
      message.success(`${name} 已手動標記為報到`);
      queryClient.invalidateQueries({ queryKey: ['checkin-roster', sessionKey] });
    },
    onError: () => message.error('報到失敗，請稍後再試'),
  });

  const undoMutation = useMutation({
    mutationFn: undoCheckIn,
    onSuccess: (_, id) => {
      const name = roster?.entries.find((e) => e.id === id)?.username ?? '';
      message.warning(`${name} 已改回未報到`);
      queryClient.invalidateQueries({ queryKey: ['checkin-roster', sessionKey] });
    },
    onError: () => message.error('取消報到失敗，請稍後再試'),
  });

  useEffect(() => {
    if (printMode) {
      const id = requestAnimationFrame(() => window.print());
      return () => cancelAnimationFrame(id);
    }
  }, [printMode]);

  useEffect(() => {
    const onAfterPrint = () => setPrintMode(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  const entries = useMemo(() => roster?.entries ?? [], [roster]);

  return (
    <>
      <Space direction="vertical" size={16} style={{ display: 'flex' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Breadcrumb items={[{ title: '課程管理' }, { title: '課程報到' }]} />
            <Typography.Title level={4} style={{ margin: 0 }}>
              課程報到
            </Typography.Title>
          </div>
          <Space wrap>
            <Button
              icon={<PrinterOutlined />}
              disabled={!roster}
              onClick={() => setPrintMode('sheet')}
            >
              列印簽到表
            </Button>
            <Button icon={<PrinterOutlined />} disabled={!roster} onClick={() => setPrintMode('qr')}>
              列印 QR Code
            </Button>
            <Button
              icon={<QrcodeOutlined />}
              disabled={!sessionKey}
              onClick={() => {
                if (sessionKey) {
                  window.open(
                    `/checkin-kiosk?mode=qr&course_id=${sessionKey.courseId}&booking_date=${sessionKey.bookingDate}&start_hour=${sessionKey.startHour}`,
                    '_blank',
                  );
                }
              }}
            >
              第二螢幕 QR 看板
            </Button>
            <Button
              icon={<TableOutlined />}
              disabled={!sessionKey}
              onClick={() => {
                if (sessionKey) {
                  window.open(
                    `/checkin-kiosk?mode=roster&course_id=${sessionKey.courseId}&booking_date=${sessionKey.bookingDate}&start_hour=${sessionKey.startHour}`,
                    '_blank',
                  );
                }
              }}
            >
              第二螢幕名單看板
            </Button>
            {sessionKey && <KioskLinkPopover sessionKey={sessionKey} />}
          </Space>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
          <Card title="選擇課程">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SessionPicker
                sessions={sessions ?? []}
                value={selection}
                onChange={setSelection}
                loading={sessionsLoading}
              />

              {roster && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <Typography.Text type="secondary">上課時間</Typography.Text>
                      <span>
                        {roster.session.booking_date} {String(roster.session.start_hour).padStart(2, '0')}:00
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <Typography.Text type="secondary">授課教練</Typography.Text>
                      <span>{roster.session.coach_name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <Typography.Text type="secondary">報名人數</Typography.Text>
                      <span>{roster.total_count} 人</span>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 1, background: '#f0f0f0' }} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ padding: 10, background: '#fafafa', borderRadius: 8 }}>
                      <Statistic
                        title="已報到"
                        value={roster.checked_in_count}
                        valueStyle={{ fontSize: 20, color: '#52c41a' }}
                      />
                    </div>
                    <div style={{ padding: 10, background: '#fafafa', borderRadius: 8 }}>
                      <Statistic
                        title="未報到"
                        value={roster.total_count - roster.checked_in_count}
                        valueStyle={{ fontSize: 20 }}
                      />
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 1, background: '#f0f0f0' }} />

                  <QrPanel {...sessionKey!} />
                </>
              )}
            </div>
          </Card>

          <Card
            title="名單與報到狀態"
            extra={<Typography.Text type="secondary">共 {entries.length} 人</Typography.Text>}
          >
            <RosterPanel
              entries={entries}
              loading={rosterLoading}
              onCheckIn={(id) => checkInMutation.mutate(id)}
              onUndo={(id) => undoMutation.mutate(id)}
            />
          </Card>
        </div>
      </Space>

      {roster && printMode && (
        <div id="checkin-print-area">
          {printMode === 'sheet' ? (
            <PrintSignInSheet session={roster.session} entries={entries} />
          ) : (
            <PrintQrSheet session={roster.session} />
          )}
        </div>
      )}

      <style>{`
        #checkin-print-area { display: none; }
        @media print {
          body * { visibility: hidden; }
          #checkin-print-area, #checkin-print-area * { visibility: visible; }
          #checkin-print-area { display: block; position: absolute; top: 0; left: 0; width: 100%; padding: 24px; }
        }
      `}</style>
    </>
  );
}

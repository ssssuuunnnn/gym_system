import { useState } from 'react';
import {
  Breadcrumb,
  Button,
  Card,
  Result,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { listCoaches } from '../../api/coaches';
import { listCoachCourseSessions, type CoachCourseSession } from '../../api/courses';
import SlotPicker, { type SlotEvent } from '../../components/SlotPicker';
import { formatMinutes, startOfWeekMon } from '../../components/calendar/shared';
import { isoWeekday } from '../../lib/availability';
import { weekdayShort } from '../../lib/weekday';

/**
 * 教練課程頁（教練管理 → 授課）：對應 Claude Design「教練課程」設計稿。
 * 檢視特定教練所帶團體課程的上課時間 —— 週行事曆 + 開課時間列表。
 * 資料來源為既有「團體課程」資料（courses + course_sessions），以 courses.coach_id 關聯。
 */

const PAST_DAYS = 28; // 開課時間列表：往前 4 週
const FUTURE_DAYS = 42; // 開課時間列表：往後 6 週
const DEFAULT_START_HOUR = 10;
const DEFAULT_END_HOUR = 22;

function dateRangeLabel(d: Dayjs): string {
  return `${d.format('YYYY/M/D')}(${weekdayShort(isoWeekday(d))})`;
}

export default function CoachCourses() {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { id } = useParams<{ id: string }>();
  const coachId = Number(id);

  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['coach-course-sessions', coachId],
    queryFn: () => listCoachCourseSessions(coachId),
    enabled: Number.isFinite(coachId),
  });

  const [anchor, setAnchor] = useState<Dayjs>(() => dayjs());

  // 直接以網址開啟：等教練列表快取載入
  if (coaches == null) {
    return (
      <Card>
        <Skeleton active />
      </Card>
    );
  }
  const coach = coaches.find((c) => c.id === coachId);
  if (!coach) {
    return (
      <Card>
        <Result
          status="404"
          title="找不到此教練資料"
          subTitle="可能已被刪除，請返回列表重新確認。"
          extra={
            <Button type="primary" onClick={() => navigate('/admin/coaches')}>
              返回教練資料列表
            </Button>
          }
        />
      </Card>
    );
  }

  const all = sessions ?? [];

  // ---- 週行事曆 ----
  const monday = startOfWeekMon(anchor);
  const weekDates = Array.from({ length: 7 }, (_, i) => monday.add(i, 'day'));
  const weekStartKey = monday.format('YYYY-MM-DD');
  const weekEndKey = monday.add(7, 'day').format('YYYY-MM-DD');
  const weekSessions = all.filter(
    (s) => s.session_date >= weekStartKey && s.session_date < weekEndKey,
  );

  // 時間軸範圍：預設 10–22，若當週課堂落在範圍外則動態撐開
  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;
  for (const s of weekSessions) {
    startHour = Math.min(startHour, Math.floor(s.start_minute / 60));
    endHour = Math.max(endHour, Math.ceil((s.start_minute + s.duration_minutes) / 60));
  }

  const byDayHour = new Map<string, CoachCourseSession[]>();
  for (const s of weekSessions) {
    const key = `${s.session_date}-${Math.floor(s.start_minute / 60)}`;
    const list = byDayHour.get(key) ?? [];
    list.push(s);
    byDayHour.set(key, list);
  }

  const eventsFor = (date: Dayjs, hour: number): SlotEvent[] =>
    (byDayHour.get(`${date.format('YYYY-MM-DD')}-${hour}`) ?? []).map((s) => ({
      key: `${s.course_id}-${s.session_date}-${s.start_minute}`,
      title: `${s.is_cancelled ? '（停課）' : ''}${s.course_name}`,
      subText: `${formatMinutes(s.start_minute)}–${formatMinutes(s.start_minute + s.duration_minutes)}`,
      tone: s.is_cancelled ? 'gray' : s.source === '加開' ? 'gold' : 'blue',
    }));

  const rangeTitle = `${dateRangeLabel(weekDates[0])} – ${dateRangeLabel(weekDates[6])}`;
  const weekCount = weekSessions.filter((s) => !s.is_cancelled).length;

  // ---- 開課時間列表：往前 4 週、往後 6 週 ----
  const todayKey = dayjs().format('YYYY-MM-DD');
  const listFromKey = dayjs().subtract(PAST_DAYS, 'day').format('YYYY-MM-DD');
  const listToKey = dayjs().add(FUTURE_DAYS, 'day').format('YYYY-MM-DD');
  const listRows = all
    .filter((s) => s.session_date >= listFromKey && s.session_date < listToKey)
    .slice()
    .sort((a, b) =>
      a.session_date === b.session_date
        ? a.start_minute - b.start_minute
        : a.session_date < b.session_date
          ? -1
          : 1,
    );
  const pastCount = listRows.filter((s) => s.session_date < todayKey).length;
  const upcomingCount = listRows.length - pastCount;

  const columns: ColumnsType<CoachCourseSession> = [
    {
      title: '序號',
      width: 64,
      render: (_v, _r, i) => (
        <span style={{ color: token.colorTextTertiary, fontSize: 13 }}>{i + 1}</span>
      ),
    },
    {
      title: '日期',
      width: 160,
      render: (_v, r) => {
        const d = dayjs(r.session_date);
        return (
          <span style={{ color: r.session_date < todayKey ? token.colorTextTertiary : undefined }}>
            {d.format('M/D')}({weekdayShort(isoWeekday(d))})
          </span>
        );
      },
    },
    {
      title: '時間',
      width: 160,
      render: (_v, r) =>
        `${formatMinutes(r.start_minute)} – ${formatMinutes(r.start_minute + r.duration_minutes)}`,
    },
    {
      title: '課程名稱',
      render: (_v, r) => (
        <Space size={8} wrap>
          <span
            style={
              r.is_cancelled
                ? { color: token.colorTextTertiary, textDecoration: 'line-through' }
                : undefined
            }
          >
            {r.course_name}
          </span>
          {r.source === '加開' && <Tag color="gold">加開</Tag>}
          {r.is_cancelled && <Tag>停課</Tag>}
          {r.course_status !== '上架' && (
            <Tag color={r.course_status === '草稿' ? 'warning' : 'default'}>{r.course_status}</Tag>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Breadcrumb items={[{ title: '課程管理' }, { title: '教練管理' }, { title: '教練課程' }]} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          教練課程
        </Typography.Title>
        <Space size={8}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            教練
          </Typography.Text>
          <Select
            value={coachId}
            style={{ width: 160 }}
            onChange={(v) => navigate(`/admin/coaches/${v}/courses`)}
            options={coaches.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Space>
      </div>

      <Card
        title="課程行事曆"
        extra={<Typography.Text type="secondary">本週 {weekCount} 堂</Typography.Text>}
      >
        <Space wrap style={{ marginBottom: 12 }}>
          <Button icon={<LeftOutlined />} onClick={() => setAnchor(monday.subtract(1, 'week'))}>
            上一週
          </Button>
          <Button icon={<RightOutlined />} onClick={() => setAnchor(monday.add(1, 'week'))}>
            下一週
          </Button>
          <Button onClick={() => setAnchor(dayjs())}>回到今天</Button>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {rangeTitle}
          </Typography.Text>
        </Space>
        <SlotPicker
          dates={weekDates}
          startHour={startHour}
          endHour={endHour}
          cellState={() => 'open'}
          cellEvents={eventsFor}
        />
      </Card>

      <Card
        title="開課時間"
        extra={
          <Typography.Text type="secondary">
            共 {listRows.length} 堂（近 4 週 {pastCount} 堂 · 未來 6 週 {upcomingCount} 堂）
          </Typography.Text>
        }
      >
        <Table
          rowKey={(r) => `${r.course_id}-${r.session_date}-${r.start_minute}`}
          columns={columns}
          dataSource={listRows}
          loading={isLoading}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: '此教練近期尚無排定課程' }}
        />
      </Card>
    </Space>
  );
}

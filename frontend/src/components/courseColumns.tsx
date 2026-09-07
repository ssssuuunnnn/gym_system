import { Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { Course } from '../api/courses';
import { weekdayLabel } from '../lib/weekday';
import { CourseCoverThumb } from './CourseCoverThumb';

/**
 * 團體課程列表（`GroupCourseList`）與封存列表（`GroupCourseArchive`）共用的課程欄位。
 * 兩頁在這 7 個共用欄位後面再各自接自己的欄位（狀態＋操作／封存資訊＋還原刪除）。
 */

export interface SharedCourseColumnDeps {
  coachNameById: Map<number, string>;
}

export function sharedCourseColumns({ coachNameById }: SharedCourseColumnDeps): ColumnsType<Course> {
  return [
    {
      title: '封面',
      dataIndex: 'cover_image_url',
      width: 96,
      render: (url: string | null) => <CourseCoverThumb url={url} />,
    },
    {
      title: '課程名稱',
      dataIndex: 'name',
      width: 200,
      render: (name: string, r) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span>{name}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.code ?? '—'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '教練',
      dataIndex: 'coach_id',
      width: 96,
      render: (coachId: number) => coachNameById.get(coachId) ?? `#${coachId}`,
    },
    {
      title: '開班人數',
      key: 'capacity',
      width: 120,
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span>
            {r.min_capacity} – {r.max_capacity} 人
          </span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            已報名 {r.enrolled_count} 人
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '課程介紹',
      dataIndex: 'description',
      width: 260,
      render: (desc: string | null) => (
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 13, marginBottom: 0 }}
          ellipsis={{ rows: 2 }}
        >
          {desc || '—'}
        </Typography.Paragraph>
      ),
    },
    {
      title: '課堂數',
      dataIndex: 'session_count',
      width: 80,
      render: (n: number) => `${n} 堂`,
    },
    {
      title: '開課時間',
      key: 'period',
      width: 210,
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13 }}>
            {r.start_date && r.end_date
              ? `${dayjs(r.start_date).format('YYYY/MM/DD')} – ${dayjs(r.end_date).format('YYYY/MM/DD')}`
              : '未設定'}
          </span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.day_of_week != null && r.start_hour != null
              ? `每${weekdayLabel(r.day_of_week)} ${r.start_hour}:00 · ${r.duration_minutes} 分鐘`
              : '未設定'}
          </Typography.Text>
        </div>
      ),
    },
  ];
}

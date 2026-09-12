import { Select } from 'antd';
import dayjs from 'dayjs';
import type { UpcomingCourseSession } from '../../../../api/courses';
import { formatMinutes } from '../../../../components/calendar/shared';
import { sessionOptionValue } from '../lib/session';

interface SessionPickerProps {
  sessions: UpcomingCourseSession[];
  value: string | null;
  onChange: (value: string) => void;
  loading?: boolean;
  size?: 'small' | 'middle';
}

/** 課程報到「選擇課程」下拉：今天／明天課堂，含課程名稱與授課教練。 */
export default function SessionPicker({ sessions, value, onChange, loading, size }: SessionPickerProps) {
  const today = dayjs().startOf('day');
  const options = sessions.map((s) => ({
    value: sessionOptionValue(s),
    label: `${s.course_name} · ${dayjs(s.session_date).isSame(today, 'day') ? '今天' : '明天'} ${formatMinutes(
      s.start_minute,
    )} · ${s.coach_name}`,
  }));

  return (
    <Select
      style={{ width: '100%' }}
      placeholder="請選擇課程"
      options={options}
      value={value ?? undefined}
      onChange={onChange}
      loading={loading}
      size={size}
      notFoundContent="今天、明天皆無排定課堂"
    />
  );
}

import { Popover, Tag, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { getTenantProfile } from '../../api/tenant';
import { formatServerTime } from '../../lib/datetime';
import { TrialContactList } from './TrialContactList';

/** 最後幾天改用警示色（與平台後台的 TRIAL_WARNING_DAYS 一致） */
const WARNING_DAYS = 7;

/** 後台頁首的「試用剩 N 天」；點開看到期日與平台聯絡方式（ADR 0013）。不是試用中就不顯示。 */
export function TrialHeaderTag() {
  const { data } = useQuery({ queryKey: ['tenant-profile'], queryFn: getTenantProfile, staleTime: 5 * 60_000 });
  const trial = data?.trial;
  if (!trial || trial.expired) return null;
  const warn = trial.days_left <= WARNING_DAYS;
  return (
    <Popover
      trigger="click"
      title="試用中"
      content={
        <div style={{ maxWidth: 320 }}>
          <Typography.Paragraph>
            試用到 {formatServerTime(trial.ends_at, 'YYYY-MM-DD HH:mm')}，期間所有功能都能使用。想繼續使用請聯絡我們轉為正式方案，資料會全部保留。
          </Typography.Paragraph>
          <TrialContactList contact={trial.contact} />
        </div>
      }
    >
      <Tag
        role="button"
        tabIndex={0}
        icon={<ClockCircleOutlined />}
        color={warn ? 'warning' : 'processing'}
        style={{ cursor: 'pointer', marginInlineEnd: 0 }}
      >
        試用剩 {trial.days_left} 天
      </Tag>
    </Popover>
  );
}

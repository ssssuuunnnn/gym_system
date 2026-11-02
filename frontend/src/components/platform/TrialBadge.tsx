import { Tag, Tooltip } from 'antd';
import type { Tenant } from '../../api/platform';
import { formatServerTime } from '../../lib/datetime';

/** 最後幾天算「快到期」（平台列表與店家後台橫幅一致） */
export const TRIAL_WARNING_DAYS = 7;

export interface TrialBadgeProps {
  tenant: Pick<Tenant, 'status' | 'trial_ends_at' | 'trial_days_left' | 'trial_expired'>;
}

/** 試用中店家的到期狀態：剩 N 天／已到期（ADR 0013）。不是試用中就不顯示。 */
export function TrialBadge({ tenant }: TrialBadgeProps) {
  if (tenant.status !== '試用' || !tenant.trial_ends_at) return null;
  const ends = `到期：${formatServerTime(tenant.trial_ends_at, 'YYYY-MM-DD HH:mm')}`;
  if (tenant.trial_expired) {
    return (
      <Tooltip title={ends}>
        <Tag color="red">已到期</Tag>
      </Tooltip>
    );
  }
  const days = tenant.trial_days_left ?? 0;
  return (
    <Tooltip title={ends}>
      <Tag color={days <= TRIAL_WARNING_DAYS ? 'orange' : 'default'}>剩 {days} 天</Tag>
    </Tooltip>
  );
}

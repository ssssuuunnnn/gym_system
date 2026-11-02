import { useEffect, type ReactNode } from 'react';
import { Flex, Result, theme, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTenantProfile, TRIAL_EXPIRED_EVENT, type PlatformContact } from '../../api/tenant';
import { formatServerTime } from '../../lib/datetime';
import { usePageTitle } from '../../lib/usePageTitle';
import { TrialContactList } from './TrialContactList';

export interface TrialGateProps {
  children: ReactNode;
}

/**
 * 試用到期（ADR 0013、R55）：店家網址的所有畫面（後台、會員、教練、LIFF、登入頁）都換成「試用已到期，請聯絡我們」。
 * 後端已經擋下所有店家 API（只剩 /tenant/profile）；這裡只負責顯示。收到 403「試用已到期」時重新讀取狀態。
 */
export function TrialGate({ children }: TrialGateProps) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['tenant-profile'], queryFn: getTenantProfile, staleTime: 5 * 60_000 });

  useEffect(() => {
    const onExpired = () => queryClient.invalidateQueries({ queryKey: ['tenant-profile'] });
    window.addEventListener(TRIAL_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(TRIAL_EXPIRED_EVENT, onExpired);
  }, [queryClient]);

  if (data?.trial?.expired) return <TrialExpiredPage name={data.name} endsAt={data.trial.ends_at} contact={data.trial.contact} />;
  return <>{children}</>;
}

function TrialExpiredPage({
  name,
  endsAt,
  contact,
}: {
  name: string;
  endsAt: string;
  contact: PlatformContact;
}) {
  const { token } = theme.useToken();
  usePageTitle(`${name}｜試用已到期`);
  return (
    <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: 16, background: token.colorBgLayout }}>
      <Result
        status="warning"
        title="試用已到期，請聯絡我們"
        subTitle={
          <Typography.Text type="secondary">
            「{name}」的試用已在 {formatServerTime(endsAt, 'YYYY-MM-DD')} 到期，後台、會員預約與形象網站暫停使用。
            <br />
            資料都還保留著，轉為正式方案後就能繼續使用。
          </Typography.Text>
        }
        extra={<TrialContactList contact={contact} vertical />}
        style={{ background: token.colorBgContainer, borderRadius: token.borderRadiusLG, maxWidth: 560 }}
      />
    </Flex>
  );
}

import { useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import {
  HomeOutlined,
  CalendarOutlined,
  ScheduleOutlined,
  UserOutlined,
  CheckSquareOutlined,
  WalletOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuthStore } from '../../store/auth';
import { getMyCoachProfile, isPayableCoach } from '../../api/coaches';
import { FRONT_MAX_WIDTH, FRONT_THEMES, TAB_BAR_HEIGHT, type FrontMode } from './memberTheme';
import { useTerms, type Terms } from '../../lib/terms';
import { useShopTitle } from '../../lib/usePageTitle';

interface TabItem {
  to: string;
  label: string;
  icon: ReactNode;
}

// 分頁名稱依行業用詞（ADR 0011）
const memberTabs = (t: Terms): TabItem[] => [
  { to: '/member/dashboard', label: '首頁', icon: <HomeOutlined /> },
  { to: '/member/book', label: t.book, icon: <CalendarOutlined /> },
  { to: '/member/bookings', label: '我的預約', icon: <ScheduleOutlined /> },
  { to: '/member/me', label: '我的', icon: <UserOutlined /> },
];

const coachToday = (t: Terms): TabItem => ({
  to: '/coach/today',
  label: t.unit === '堂' ? '今日課表' : '今日預約',
  icon: <CheckSquareOutlined />,
});
const coachRecords = (t: Terms): TabItem => ({ to: '/coach/attendance', label: `${t.checkIn}紀錄`, icon: <UnorderedListOutlined /> });
const coachPayouts = (t: Terms): TabItem => ({
  to: '/coach/payouts',
  label: t.unit === '堂' ? '我的鐘點' : '我的服務費',
  icon: <WalletOutlined />,
});
const COACH_ME: TabItem = { to: '/coach/me', label: '我的', icon: <UserOutlined /> };

export interface MemberLayoutProps {
  /** member＝會員前台（品牌藍）；coach＝教練前台（深青綠），僅綁定教練資料的會員可進入 */
  mode: FrontMode;
}

/**
 * 前台版面（會員與教練共用）：手機優先的單欄內容 + 底部分頁列，桌機置中顯示。
 * 與後台 AppLayout 分開（見 layout-conventions skill）；主題以巢狀 ConfigProvider 切換。
 */
export default function MemberLayout({ mode }: MemberLayoutProps) {
  const { mustChangePassword, isCoach } = useAuthStore();
  const location = useLocation();
  const { t } = useTerms();
  // 分頁標題：會員端就是店名；教練端加上「教練專區」（美體：美容師專區）
  useShopTitle(mode === 'coach' ? `${t.staff}專區` : undefined);

  // 教練類型不在 JWT 內（管理員可隨時調整），登入後另外讀取，決定是否顯示「我的鐘點」
  const { data: coachProfile } = useQuery({
    queryKey: ['my-coach-profile'],
    queryFn: getMyCoachProfile,
    enabled: isCoach,
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // 管理員重設密碼並要求自行修改：完成前只能停留在修改密碼頁
  if (mustChangePassword) return <Navigate to="/member/change-password" replace />;
  // 教練前台僅限教練身份
  if (mode === 'coach' && !isCoach) return <Navigate to="/member/dashboard" replace />;

  const tabs =
    mode === 'member'
      ? memberTabs(t)
      : [coachToday(t), coachRecords(t), ...(isPayableCoach(coachProfile?.coach_types) ? [coachPayouts(t)] : []), COACH_ME];

  return (
    <ConfigProvider theme={FRONT_THEMES[mode]}>
      <FrontShell tabs={tabs} />
    </ConfigProvider>
  );
}

function FrontShell({ tabs }: { tabs: TabItem[] }) {
  const { token } = theme.useToken();

  return (
    <div style={{ minHeight: '100vh', background: token.colorBgLayout, color: token.colorText, fontFamily: token.fontFamily }}>
      <main
        style={{
          maxWidth: FRONT_MAX_WIDTH,
          margin: '0 auto',
          padding: `24px 16px calc(${TAB_BAR_HEIGHT + 24}px + env(safe-area-inset-bottom))`,
          boxSizing: 'border-box',
        }}
      >
        <Outlet />
      </main>

      <nav
        aria-label="主選單"
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: FRONT_MAX_WIDTH,
          boxSizing: 'border-box',
          height: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          display: 'grid',
          gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
          zIndex: 100,
        }}
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              minHeight: 44,
              textDecoration: 'none',
              fontSize: 11,
              fontWeight: isActive ? 700 : 400,
              color: isActive ? token.colorPrimary : token.colorTextSecondary,
            })}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">
              {tab.icon}
            </span>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

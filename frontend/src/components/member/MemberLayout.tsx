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

interface TabItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const MEMBER_TABS: TabItem[] = [
  { to: '/member/dashboard', label: '首頁', icon: <HomeOutlined /> },
  { to: '/member/book', label: '預約課程', icon: <CalendarOutlined /> },
  { to: '/member/bookings', label: '我的預約', icon: <ScheduleOutlined /> },
  { to: '/member/me', label: '我的', icon: <UserOutlined /> },
];

const COACH_TODAY: TabItem = { to: '/coach/today', label: '今日課表', icon: <CheckSquareOutlined /> };
const COACH_RECORDS: TabItem = { to: '/coach/attendance', label: '簽到紀錄', icon: <UnorderedListOutlined /> };
const COACH_PAYOUTS: TabItem = { to: '/coach/payouts', label: '我的鐘點', icon: <WalletOutlined /> };
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
      ? MEMBER_TABS
      : [COACH_TODAY, COACH_RECORDS, ...(isPayableCoach(coachProfile?.coach_types) ? [COACH_PAYOUTS] : []), COACH_ME];

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

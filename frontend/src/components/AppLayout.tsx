import { useEffect, useState } from 'react';
import { Layout, Menu, Button, Typography, theme } from 'antd';
import {
  DashboardOutlined,
  AuditOutlined,
  UserSwitchOutlined,
  ShoppingOutlined,
  CalendarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { getSettings } from '../api/settings';

const DEFAULT_BRAND_NAME = '健身工作室管理系統';
import { usePageActionBarStore } from '../store/pageActionBar';

const { Header, Sider, Content } = Layout;

// 版面度量與毛玻璃效果數值，對應 gym-system-design/DESIGN_GUIDELINES.md 第 6、7.3 節
const HEADER_HEIGHT = 64;
const SIDER_WIDTH = 208;
const SIDER_COLLAPSED_WIDTH = 56;
const CONTENT_PADDING = 24;
const SCROLL_BLUR_THRESHOLD = 4;

/**
 * 共用版型：依角色顯示不同側邊欄。
 * 導覽結構採用「對照 Claude Design 視覺化 Mockup」章節確認的精簡版分組：
 * 管理員 6 大類（含儀表板）、會員（場租教練）3 大類。畫面本身數量不變，只是入口收合。
 */
const adminMenuItems = [
  { key: '/admin/dashboard', label: '儀表板', icon: <DashboardOutlined /> },
  { key: '/admin/reservations', label: '預約審核', icon: <AuditOutlined /> },
  { key: '/admin/coaches', label: '教練管理', icon: <UserSwitchOutlined /> },
  { key: '/admin/products', label: '商品管理', icon: <ShoppingOutlined /> },
  { key: '/admin/courses', label: '課程管理', icon: <CalendarOutlined /> },
  { key: '/admin/members', label: '會員管理', icon: <TeamOutlined /> },
  { key: '/admin/settings', label: '系統設定', icon: <SettingOutlined /> },
  { key: '/admin/availability', label: '公休設定', icon: <ClockCircleOutlined /> },
];

const memberMenuItems = [
  { key: '/member/dashboard', label: '儀表板', icon: <DashboardOutlined /> },
  { key: '/member/products', label: '我的商品', icon: <ShoppingOutlined /> },
  { key: '/member/bookings', label: '我的預約', icon: <CalendarOutlined /> },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, username, logout, isCoach, mustChangePassword } = useAuthStore();
  const { token } = theme.useToken();
  const actionBarContent = usePageActionBarStore((s) => s.content);
  const [collapsed, setCollapsed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // 供任何已登入身份讀取，讓管理員與會員側欄皆能顯示系統設定所維護的品牌名稱／LOGO
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSettings });
  const brandName = settings?.short_name || settings?.company_name || DEFAULT_BRAND_NAME;
  const brandInitial = brandName.charAt(0).toUpperCase();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > SCROLL_BLUR_THRESHOLD);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 管理員在「會員詳情」重設密碼並要求會員自行修改：完成修改前僅能停留在修改密碼頁
  if (mustChangePassword) {
    return <Navigate to="/member/change-password" replace />;
  }

  const items = role === 'admin' ? adminMenuItems : memberMenuItems;
  const selectedKey = items.find((item) => location.pathname.startsWith(item.key))?.key;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="light"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={SIDER_COLLAPSED_WIDTH}
        width={SIDER_WIDTH}
        style={{ borderRight: '1px solid #f0f0f0' }}
      >
        <div
          style={{
            height: HEADER_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            padding: collapsed ? 0 : '0 20px',
            overflow: 'hidden',
          }}
        >
          {settings?.logo_url ? (
            <img
              src={settings.logo_url}
              alt=""
              style={{ width: 28, height: 28, flex: 'none', borderRadius: token.borderRadiusSM, objectFit: 'contain' }}
            />
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                flex: 'none',
                borderRadius: token.borderRadiusSM,
                background: token.colorPrimary,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {brandInitial}
            </div>
          )}
          {!collapsed && (
            <span
              style={{
                fontWeight: 600,
                fontSize: 16,
                color: 'rgba(0,0,0,0.88)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {brandName}
            </span>
          )}
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={selectedKey ? [selectedKey] : []}
          items={items}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            height: HEADER_HEIGHT,
            lineHeight: `${HEADER_HEIGHT}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            background: scrolled ? 'rgba(255,255,255,0.45)' : '#ffffff',
            backdropFilter: scrolled ? 'blur(18px) saturate(180%)' : 'none',
            WebkitBackdropFilter: scrolled ? 'blur(18px) saturate(180%)' : 'none',
            boxShadow: scrolled ? '0 1px 4px rgba(0,21,41,0.08)' : 'none',
            borderBottom: scrolled ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
            transition: 'background .25s, box-shadow .25s',
          }}
        >
          <Typography.Text>
            {username}（{role === 'admin' ? '管理員' : isCoach ? '場租教練' : '學員'}）
          </Typography.Text>
          <Button
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            登出
          </Button>
        </Header>
        <Content style={{ margin: CONTENT_PADDING }}>
          <Outlet />
        </Content>
        {actionBarContent ? (
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              zIndex: 10,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              padding: '14px 24px',
              background: token.colorBgContainer,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              boxShadow: token.boxShadowSecondary,
            }}
          >
            {actionBarContent}
          </div>
        ) : null}
      </Layout>
    </Layout>
  );
}

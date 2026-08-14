import { useState } from 'react';
import { Layout, Menu, Button, Typography } from 'antd';
import {
  DashboardOutlined,
  AuditOutlined,
  SolutionOutlined,
  ShoppingOutlined,
  ScheduleOutlined,
  TeamOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

const { Header, Sider, Content } = Layout;

/**
 * 共用版型：依角色顯示不同側邊欄。
 * 導覽結構採用「對照 Claude Design 視覺化 Mockup」章節確認的精簡版分組：
 * 管理員 6 大類、會員（場租教練）3 大類。畫面本身數量不變，只是入口收合。
 * 版型視覺比照 gym-system-design 設計稿：淺色側邊欄 + 導覽圖示，取代 antd 預設深色 Sider。
 */
const adminMenuItems = [
  { key: '/admin/dashboard', label: '儀表板', icon: <DashboardOutlined /> },
  { key: '/admin/reservations', label: '預約審核', icon: <AuditOutlined /> },
  { key: '/admin/coaches', label: '教練管理', icon: <SolutionOutlined /> },
  { key: '/admin/products', label: '商品管理', icon: <ShoppingOutlined /> },
  { key: '/admin/courses', label: '課程管理', icon: <ScheduleOutlined /> },
  { key: '/admin/members', label: '會員管理', icon: <TeamOutlined /> },
  { key: '/admin/slot-settings', label: '時段設定', icon: <ClockCircleOutlined /> },
];

const memberMenuItems = [
  { key: '/member/dashboard', label: '儀表板', icon: <DashboardOutlined /> },
  { key: '/member/products', label: '我的商品', icon: <ShoppingOutlined /> },
  { key: '/member/bookings', label: '我的預約', icon: <ScheduleOutlined /> },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, username, logout, isCoach } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const items = role === 'admin' ? adminMenuItems : memberMenuItems;
  const selectedKey = items.find((item) => location.pathname.startsWith(item.key))?.key;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        width={208}
        collapsedWidth={56}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ borderRight: '1px solid #f0f0f0' }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: collapsed ? 0 : '0 20px',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              background: '#1677ff',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            健
          </div>
          {!collapsed && (
            <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(0, 0, 0, 0.88)', whiteSpace: 'nowrap' }}>
              健身工作室管理系統
            </span>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKey ? [selectedKey] : []}
          items={items}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            boxShadow: '0 1px 4px rgba(0, 21, 41, 0.08)',
          }}
        >
          <Typography.Text>
            {username}（{role === 'admin' ? '管理員' : isCoach ? '場租教練' : '學員'}）
          </Typography.Text>
          <Button onClick={() => { logout(); navigate('/login'); }}>登出</Button>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

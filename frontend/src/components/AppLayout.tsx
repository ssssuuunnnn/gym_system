import { Layout, Menu, Button, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

const { Header, Sider, Content } = Layout;

/**
 * 共用版型：依角色顯示不同側邊欄。
 * 導覽結構採用「對照 Claude Design 視覺化 Mockup」章節確認的精簡版分組：
 * 管理員 6 大類、會員（場租教練）3 大類。畫面本身數量不變，只是入口收合。
 */
const adminMenuItems = [
  { key: '/admin/reservations', label: '預約審核' },
  { key: '/admin/coaches', label: '教練管理' },
  { key: '/admin/products', label: '商品管理' },
  { key: '/admin/courses', label: '課程管理' },
  { key: '/admin/members', label: '會員管理' },
  { key: '/admin/slot-settings', label: '時段設定' },
];

const memberMenuItems = [
  { key: '/member/dashboard', label: '儀表板' },
  { key: '/member/products', label: '我的商品' },
  { key: '/member/bookings', label: '我的預約' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, username, logout, isCoach } = useAuthStore();

  const items = role === 'admin' ? adminMenuItems : memberMenuItems;
  const selectedKey = items.find((item) => location.pathname.startsWith(item.key))?.key;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ color: '#fff', padding: 16, fontWeight: 600 }}>健身工作室管理系統</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKey ? [selectedKey] : []}
          items={items}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
          <Typography.Text>
            {username}（{role === 'admin' ? '管理員' : isCoach ? '場租教練' : '學員'}）
          </Typography.Text>
          <Button onClick={() => { logout(); navigate('/login'); }}>登出</Button>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

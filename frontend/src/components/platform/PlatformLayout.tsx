import { ShopOutlined, HistoryOutlined, UserOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { Navigate, useNavigate } from 'react-router-dom';
import { usePlatformAuthStore } from '../../store/platformAuth';
import BackOfficeShell, { type BackOfficeMenuItem } from '../BackOfficeShell';

/**
 * 平台管理後台版型：共用健身房後台的 BackOfficeShell，只換導覽與登入者。
 * 只在 platform.<主網域> 出現（見 docs/adr/0002-platform-console.md）。
 */
const platformMenuItems: BackOfficeMenuItem[] = [
  { key: '/tenants', label: '健身房', icon: <ShopOutlined /> },
  { key: '/audit-logs', label: '操作紀錄', icon: <HistoryOutlined /> },
];

export default function PlatformLayout() {
  const navigate = useNavigate();
  const { token, username, logout } = usePlatformAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <BackOfficeShell
      menuItems={platformMenuItems}
      brandName="平台管理"
      userLabel={`${username}（平台管理員）`}
      headerExtra={
        <Button type="text" icon={<UserOutlined />} onClick={() => navigate('/account')}>
          帳號設定
        </Button>
      }
      onLogout={() => {
        logout();
        navigate('/login');
      }}
    />
  );
}

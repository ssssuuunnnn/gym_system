import { ShopOutlined, HistoryOutlined, UserOutlined, MessageOutlined, GlobalOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { Navigate, useNavigate } from 'react-router-dom';
import { usePlatformAuthStore } from '../../store/platformAuth';
import BackOfficeShell, { type BackOfficeMenuItem } from '../BackOfficeShell';
import { usePageTitle } from '../../lib/usePageTitle';

/**
 * 平台管理後台版型：共用店家後台的 BackOfficeShell，只換導覽與登入者。
 * 只在 platform.<主網域> 出現（見 docs/adr/0002-platform-console.md）。
 */
const platformMenuItems: BackOfficeMenuItem[] = [
  { key: '/tenants', label: '店家', icon: <ShopOutlined /> },
  { key: '/line', label: 'LINE 通知', icon: <MessageOutlined /> },
  { key: '/landing', label: '形象頁設定', icon: <GlobalOutlined /> },
  { key: '/audit-logs', label: '操作紀錄', icon: <HistoryOutlined /> },
];

export default function PlatformLayout() {
  usePageTitle('Bookdex 預約簿｜平台管理');
  const navigate = useNavigate();
  const { token, username, logout } = usePlatformAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <BackOfficeShell
      menuItems={platformMenuItems}
      brandName="Bookdex 預約簿"
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

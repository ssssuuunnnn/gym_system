import {
  DashboardOutlined,
  AuditOutlined,
  UserSwitchOutlined,
  ShoppingOutlined,
  CalendarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  DollarOutlined,
  AccountBookOutlined,
} from '@ant-design/icons';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { getSettings } from '../api/settings';
import BackOfficeShell, { type BackOfficeMenuItem } from './BackOfficeShell';

const DEFAULT_BRAND_NAME = '健身工作室管理系統';

/**
 * 健身房後台版型（管理員）：共用 BackOfficeShell，換上健身房的導覽與品牌。
 * 會員與教練使用前台版型 components/member/MemberLayout.tsx；平台管理後台用 components/platform/PlatformLayout.tsx。
 * 導覽結構採用「對照 Claude Design 視覺化 Mockup」章節確認的精簡版分組。
 */
const adminMenuItems: BackOfficeMenuItem[] = [
  { key: '/admin/dashboard', label: '儀表板', icon: <DashboardOutlined /> },
  { key: '/admin/reservations', label: '預約審核', icon: <AuditOutlined /> },
  { key: '/admin/coaches', label: '教練管理', icon: <UserSwitchOutlined /> },
  { key: '/admin/coach-payouts', label: '教練鐘點', icon: <AccountBookOutlined /> },
  { key: '/admin/products', label: '商品管理', icon: <ShoppingOutlined /> },
  { key: '/admin/purchases', label: '購買紀錄', icon: <DollarOutlined /> },
  { key: '/admin/courses', label: '課程管理', icon: <CalendarOutlined /> },
  { key: '/admin/members', label: '會員管理', icon: <TeamOutlined /> },
  { key: '/admin/settings', label: '系統設定', icon: <SettingOutlined /> },
  { key: '/admin/availability', label: '公休設定', icon: <ClockCircleOutlined /> },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const { username, logout, mustChangePassword } = useAuthStore();
  // 供任何已登入身份讀取，讓側欄顯示系統設定所維護的品牌名稱／LOGO
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSettings });

  // 管理員在「會員詳情」重設密碼並要求會員自行修改：完成修改前僅能停留在修改密碼頁
  if (mustChangePassword) {
    return <Navigate to="/member/change-password" replace />;
  }

  return (
    <BackOfficeShell
      menuItems={adminMenuItems}
      brandName={settings?.short_name || settings?.company_name || DEFAULT_BRAND_NAME}
      brandLogoUrl={settings?.logo_url}
      userLabel={`${username}（管理員）`}
      onLogout={() => {
        logout();
        navigate('/login');
      }}
    />
  );
}

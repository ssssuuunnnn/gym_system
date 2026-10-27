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
  GlobalOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { Badge } from 'antd';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { getSettings } from '../api/settings';
import { getInquirySummary } from '../api/inquiries';
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
  { key: '/admin/website', label: '形象網站', icon: <GlobalOutlined /> },
  { key: '/admin/inquiries', label: '詢問名單', icon: <MessageOutlined /> },
  { key: '/admin/settings', label: '系統設定', icon: <SettingOutlined /> },
  { key: '/admin/availability', label: '公休設定', icon: <ClockCircleOutlined /> },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const { username, logout, mustChangePassword } = useAuthStore();
  // 供任何已登入身份讀取，讓側欄顯示系統設定所維護的品牌名稱／LOGO
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSettings });
  // 側欄「詢問名單」顯示新詢問數；每分鐘更新一次
  const { data: inquirySummary } = useQuery({
    queryKey: ['inquiries-summary'],
    queryFn: getInquirySummary,
    refetchInterval: 60_000,
  });
  const newInquiries = inquirySummary?.new_count ?? 0;
  const menuItems = adminMenuItems.map((item) =>
    item.key === '/admin/inquiries' && newInquiries > 0
      ? {
          ...item,
          label: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {item.label}
              <Badge count={newInquiries} size="small" aria-label={`${newInquiries} 筆新詢問`} />
            </span>
          ),
        }
      : item,
  );

  // 管理員在「會員詳情」重設密碼並要求會員自行修改：完成修改前僅能停留在修改密碼頁
  if (mustChangePassword) {
    return <Navigate to="/member/change-password" replace />;
  }

  return (
    <BackOfficeShell
      menuItems={menuItems}
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

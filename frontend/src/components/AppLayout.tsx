import { Badge } from 'antd';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { getSettings } from '../api/settings';
import { getInquirySummary } from '../api/inquiries';
import BackOfficeShell from './BackOfficeShell';
import { ADMIN_MENU, allows } from './adminMenu';
import { usePermissions } from '../lib/permissions';

const DEFAULT_BRAND_NAME = '健身工作室管理系統';

/**
 * 健身房後台版型（管理員）：共用 BackOfficeShell，換上健身房的導覽與品牌。
 * 會員與教練使用前台版型 components/member/MemberLayout.tsx；平台管理後台用 components/platform/PlatformLayout.tsx。
 * 導覽結構採用「對照 Claude Design 視覺化 Mockup」章節確認的精簡版分組。
 */
// 側欄項目與對應的功能權限在 components/adminMenu.tsx（路由守衛共用）

export default function AppLayout() {
  const navigate = useNavigate();
  const { username, logout, mustChangePassword } = useAuthStore();
  const queryClient = useQueryClient();
  // 供任何已登入身份讀取，讓側欄顯示系統設定所維護的品牌名稱／LOGO
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSettings });
  // 側欄「詢問名單」顯示新詢問數；每分鐘更新一次
  // 後台功能權限（ADR 0008）：側欄只顯示這個帳號能用的功能
  const { can, isOwner, level } = usePermissions();
  const { data: inquirySummary } = useQuery({
    queryKey: ['inquiries-summary'],
    queryFn: getInquirySummary,
    refetchInterval: 60_000,
    enabled: can('inquiries'),
  });
  const newInquiries = inquirySummary?.new_count ?? 0;
  const menuItems = ADMIN_MENU.filter((m) => allows(m.perm, can, isOwner)).map(({ key, label, icon }) => ({
    key,
    label,
    icon,
  })).map((item) =>
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
      userLabel={`${username}（${level ?? '管理員'}）`}
      onLogout={() => {
        logout();
        queryClient.clear();
        navigate('/login');
      }}
    />
  );
}

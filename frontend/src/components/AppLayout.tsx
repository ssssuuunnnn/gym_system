import { useEffect } from 'react';
import { HistoryOutlined, PushpinOutlined } from '@ant-design/icons';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { getSettings } from '../api/settings';
import { getInquirySummary } from '../api/inquiries';
import BackOfficeShell, { type BackOfficeMenuItem } from './BackOfficeShell';
import { ADMIN_MENU, ADMIN_MENU_GROUPS, allows, menuEntryFor, menuGroupLabel, menuHidden, menuLabel, type AdminMenuEntry } from './adminMenu';
import { usePermissions } from '../lib/permissions';
import { RECENT_MENU_LIMIT, useAdminMenuPrefs } from '../lib/useAdminMenuPrefs';
import { NotificationBell } from './notifications/NotificationBell';
import { useTerms } from '../lib/terms';
import { useShopTitle } from '../lib/usePageTitle';


/**
 * 健身房後台版型（管理員）：共用 BackOfficeShell，換上健身房的導覽與品牌。
 * 會員與教練使用前台版型 components/member/MemberLayout.tsx；平台管理後台用 components/platform/PlatformLayout.tsx。
 * 導覽結構採用「對照 Claude Design 視覺化 Mockup」章節確認的精簡版分組。
 */
// 側欄項目與對應的功能權限在 components/adminMenu.tsx（路由守衛共用）

export default function AppLayout() {
  useShopTitle('管理後台');
  const navigate = useNavigate();
  const { username, logout, mustChangePassword } = useAuthStore();
  const queryClient = useQueryClient();
  // 供任何已登入身份讀取，讓側欄顯示系統設定所維護的品牌名稱／LOGO
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSettings });
  // 後台功能權限（ADR 0008）：側欄只顯示這個帳號能用的功能
  const { can, isOwner, level } = usePermissions();
  // 側欄「詢問名單」顯示新詢問數；每分鐘更新一次
  const { data: inquirySummary } = useQuery({
    queryKey: ['inquiries-summary'],
    queryFn: getInquirySummary,
    refetchInterval: 60_000,
    enabled: can('inquiries'),
  });
  const newInquiries = inquirySummary?.new_count ?? 0;

  // 側欄：釘選 → 最近使用 → 儀表板 → 各分類（只放有權限的功能；沒有項目的分類不顯示）
  const location = useLocation();
  const prefs = useAdminMenuPrefs();
  // 行業用詞與團體課程開關（ADR 0011）
  const { t, groupClassesEnabled } = useTerms();
  const allowed = ADMIN_MENU.filter((m) => allows(m.perm, can, isOwner) && !menuHidden(m, groupClassesEnabled));
  const allowedByKey = new Map(allowed.map((m) => [m.key, m]));
  const leaf = (m: AdminMenuEntry, prefix = ''): BackOfficeMenuItem => ({
    key: `${prefix}${m.key}`,
    path: m.key,
    label: menuLabel(m, t),
    icon: m.icon,
    badge: m.key === '/admin/inquiries' ? newInquiries : undefined,
  });
  // 最近使用不列目前這一頁與已釘選的，留位置給其他功能
  const currentEntry = menuEntryFor(location.pathname)?.key;
  const pinnedEntries = prefs.pinned.flatMap((k) => allowedByKey.get(k) ?? []);
  const recentEntries = prefs.recent
    .filter((k) => k !== currentEntry && !prefs.pinned.includes(k))
    .flatMap((k) => allowedByKey.get(k) ?? [])
    .slice(0, RECENT_MENU_LIMIT);
  const menuItems: BackOfficeMenuItem[] = [
    ...(pinnedEntries.length
      ? [{ key: 'pinned', label: '釘選', icon: <PushpinOutlined />, children: pinnedEntries.map((m) => leaf(m, 'pinned:')) }]
      : []),
    ...(recentEntries.length
      ? [{ key: 'recent', label: '最近使用', icon: <HistoryOutlined />, children: recentEntries.map((m) => leaf(m, 'recent:')) }]
      : []),
    ...allowed.filter((m) => m.group === null).map((m) => leaf(m)),
    ...ADMIN_MENU_GROUPS.flatMap((g) => {
      const children = allowed.filter((m) => m.group === g.key).map((m) => leaf(m));
      return children.length ? [{ key: g.key, label: menuGroupLabel(g, t), icon: g.icon, children }] : [];
    }),
  ];

  // 記下最近用過的功能（詳情、編輯頁算在所屬的選單）
  const { touch } = prefs;
  useEffect(() => {
    if (currentEntry && prefs.ready) touch(currentEntry);
  }, [currentEntry, prefs.ready, touch]);

  // 管理員在「會員詳情」重設密碼並要求會員自行修改：完成修改前僅能停留在修改密碼頁
  if (mustChangePassword) {
    return <Navigate to="/member/change-password" replace />;
  }

  return (
    <BackOfficeShell
      menuItems={menuItems}
      defaultOpenKeys={['pinned', 'recent']}
      openStateStorageKey={`adminMenuOpen:${window.location.hostname}`}
      pinnedPaths={prefs.pinned}
      onTogglePin={prefs.togglePin}
      brandName={settings?.short_name || settings?.company_name || t.systemName}
      brandLogoUrl={settings?.logo_url}
      userLabel={`${username}（${level ?? '管理員'}）`}
      headerExtra={<NotificationBell />}
      onLogout={() => {
        logout();
        queryClient.clear();
        navigate('/login');
      }}
    />
  );
}

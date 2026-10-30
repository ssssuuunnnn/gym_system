import type { ReactNode } from 'react';
import {
  AccountBookOutlined,
  AuditOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  ControlOutlined,
  DashboardOutlined,
  DollarOutlined,
  GiftOutlined,
  GlobalOutlined,
  IdcardOutlined,
  MessageOutlined,
  NotificationOutlined,
  SafetyOutlined,
  ScheduleOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  SoundOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type { PermissionCode } from '../api/staff';

/** 'owner'＝只有主要管理者看得到（後台帳號） */
export type MenuPermission = PermissionCode | 'owner';

/** 側欄分類（可收合）；null＝不分類，放在分類上方（儀表板） */
export type AdminMenuGroupKey = 'booking' | 'sales' | 'marketing' | 'coaching' | 'setup';

export interface AdminMenuGroup {
  key: AdminMenuGroupKey;
  label: string;
  icon: ReactNode;
}

export interface AdminMenuEntry {
  key: string;
  label: string;
  icon: ReactNode;
  perm: MenuPermission;
  group: AdminMenuGroupKey | null;
}

/** 側欄分類，依日常工作流程排序 */
export const ADMIN_MENU_GROUPS: AdminMenuGroup[] = [
  { key: 'booking', label: '預約與課程', icon: <ScheduleOutlined /> },
  { key: 'sales', label: '會員與銷售', icon: <ShoppingCartOutlined /> },
  { key: 'marketing', label: '行銷', icon: <SoundOutlined /> },
  { key: 'coaching', label: '教練', icon: <IdcardOutlined /> },
  { key: 'setup', label: '設定', icon: <ControlOutlined /> },
];

/**
 * 健身房後台側欄：選單 ↔ 分類 ↔ 功能權限的唯一對照表（順序＝側欄裡的順序）。
 * 側欄只顯示有權限的項目；路由也用同一個對照表擋住沒權限的頁面（router/RequirePerm.tsx）。
 * 釘選與最近使用只記得這裡的 key（見 lib/useAdminMenuPrefs.ts）。
 */
export const ADMIN_MENU: AdminMenuEntry[] = [
  { key: '/admin/dashboard', label: '儀表板', icon: <DashboardOutlined />, perm: 'dashboard', group: null },
  { key: '/admin/reservations', label: '預約審核', icon: <AuditOutlined />, perm: 'reservations', group: 'booking' },
  { key: '/admin/courses', label: '課程管理', icon: <CalendarOutlined />, perm: 'courses', group: 'booking' },
  { key: '/admin/availability', label: '公休設定', icon: <ClockCircleOutlined />, perm: 'availability', group: 'booking' },
  { key: '/admin/members', label: '會員管理', icon: <TeamOutlined />, perm: 'members', group: 'sales' },
  { key: '/admin/purchases', label: '購買紀錄', icon: <DollarOutlined />, perm: 'purchases', group: 'sales' },
  { key: '/admin/products', label: '商品管理', icon: <ShoppingOutlined />, perm: 'products', group: 'sales' },
  { key: '/admin/member-segments', label: '會員名單', icon: <NotificationOutlined />, perm: 'segments', group: 'marketing' },
  { key: '/admin/coupons', label: '優惠券', icon: <GiftOutlined />, perm: 'coupons', group: 'marketing' },
  { key: '/admin/inquiries', label: '詢問名單', icon: <MessageOutlined />, perm: 'inquiries', group: 'marketing' },
  { key: '/admin/website', label: '形象網站', icon: <GlobalOutlined />, perm: 'website', group: 'marketing' },
  { key: '/admin/coaches', label: '教練管理', icon: <UserSwitchOutlined />, perm: 'coaches', group: 'coaching' },
  { key: '/admin/coach-payouts', label: '教練鐘點', icon: <AccountBookOutlined />, perm: 'payouts', group: 'coaching' },
  { key: '/admin/branches', label: '分店管理', icon: <ShopOutlined />, perm: 'branches', group: 'setup' },
  { key: '/admin/settings', label: '系統設定', icon: <SettingOutlined />, perm: 'settings', group: 'setup' },
  { key: '/admin/staff', label: '後台帳號', icon: <SafetyOutlined />, perm: 'owner', group: 'setup' },
];

/** 網址屬於哪個選單（最長前綴優先：/admin/members/12 → 會員管理） */
export function menuEntryFor(pathname: string): AdminMenuEntry | undefined {
  return [...ADMIN_MENU]
    .sort((a, b) => b.key.length - a.key.length)
    .find((m) => pathname === m.key || pathname.startsWith(`${m.key}/`));
}

export function allows(perm: MenuPermission, can: (code: PermissionCode) => boolean, isOwner: boolean) {
  return perm === 'owner' ? isOwner : can(perm);
}

/** 這個帳號第一個能用的頁面（登入後、沒有儀表板權限時用） */
export function firstAllowedPath(can: (code: PermissionCode) => boolean, isOwner: boolean): string | null {
  return ADMIN_MENU.find((m) => allows(m.perm, can, isOwner))?.key ?? null;
}

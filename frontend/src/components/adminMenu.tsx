import type { ReactNode } from 'react';
import {
  AccountBookOutlined,
  AuditOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DollarOutlined,
  GlobalOutlined,
  MessageOutlined,
  NotificationOutlined,
  SafetyOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type { PermissionCode } from '../api/staff';

/** 'owner'＝只有主要管理者看得到（後台帳號） */
export type MenuPermission = PermissionCode | 'owner';

export interface AdminMenuEntry {
  key: string;
  label: string;
  icon: ReactNode;
  perm: MenuPermission;
}

/**
 * 健身房後台側欄（順序＝功能權限清單的順序，見後端 services/staff.PERMISSIONS）。
 * 側欄只顯示有權限的項目；路由也用同一個對照表擋住沒權限的頁面（router/RequirePerm.tsx）。
 */
export const ADMIN_MENU: AdminMenuEntry[] = [
  { key: '/admin/dashboard', label: '儀表板', icon: <DashboardOutlined />, perm: 'dashboard' },
  { key: '/admin/reservations', label: '預約審核', icon: <AuditOutlined />, perm: 'reservations' },
  { key: '/admin/coaches', label: '教練管理', icon: <UserSwitchOutlined />, perm: 'coaches' },
  { key: '/admin/coach-payouts', label: '教練鐘點', icon: <AccountBookOutlined />, perm: 'payouts' },
  { key: '/admin/products', label: '商品管理', icon: <ShoppingOutlined />, perm: 'products' },
  { key: '/admin/purchases', label: '購買紀錄', icon: <DollarOutlined />, perm: 'purchases' },
  { key: '/admin/courses', label: '課程管理', icon: <CalendarOutlined />, perm: 'courses' },
  { key: '/admin/members', label: '會員管理', icon: <TeamOutlined />, perm: 'members' },
  { key: '/admin/member-segments', label: '會員名單', icon: <NotificationOutlined />, perm: 'segments' },
  { key: '/admin/website', label: '形象網站', icon: <GlobalOutlined />, perm: 'website' },
  { key: '/admin/inquiries', label: '詢問名單', icon: <MessageOutlined />, perm: 'inquiries' },
  { key: '/admin/branches', label: '分店管理', icon: <ShopOutlined />, perm: 'branches' },
  { key: '/admin/staff', label: '後台帳號', icon: <SafetyOutlined />, perm: 'owner' },
  { key: '/admin/settings', label: '系統設定', icon: <SettingOutlined />, perm: 'settings' },
  { key: '/admin/availability', label: '公休設定', icon: <ClockCircleOutlined />, perm: 'availability' },
];

export function allows(perm: MenuPermission, can: (code: PermissionCode) => boolean, isOwner: boolean) {
  return perm === 'owner' ? isOwner : can(perm);
}

/** 這個帳號第一個能用的頁面（登入後、沒有儀表板權限時用） */
export function firstAllowedPath(can: (code: PermissionCode) => boolean, isOwner: boolean): string | null {
  return ADMIN_MENU.find((m) => allows(m.perm, can, isOwner))?.key ?? null;
}

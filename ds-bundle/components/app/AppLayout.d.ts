import React from 'react';
export interface AppLayoutProps {
  /** 目前使用者角色，決定側邊欄選單（管理員 7 項 / 會員 3 項） */
  role?: 'admin' | 'member';
  /** 頁首顯示的使用者名稱 */
  username?: string;
  /** 角色為 member 且具教練身分時，頁首標註「場租教練」 */
  isCoach?: boolean;
  /** 目前選中的選單 key（通常等於路由 pathname） */
  activeKey?: string;
  /** 內容捲動時，頁首切換為毛玻璃樣式 */
  scrolled?: boolean;
  /** 側邊欄初始是否收合 */
  defaultCollapsed?: boolean;
  /** 點擊選單項目的回呼，參數為該項 key */
  onNavigate?: (key: string) => void;
  /** 點擊「登出」的回呼 */
  onLogout?: () => void;
  /** 主內容區 */
  children?: React.ReactNode;
}
export function AppLayout(props: AppLayoutProps): JSX.Element;

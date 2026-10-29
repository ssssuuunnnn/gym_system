import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Layout, Menu, Button, Typography, theme, type MenuProps } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { usePageActionBarStore } from '../store/pageActionBar';
import { BackOfficeMenuLabel } from './BackOfficeMenuLabel';

const { Header, Sider, Content } = Layout;

// 版面度量與毛玻璃效果數值，對應 gym-system-design/DESIGN_GUIDELINES.md 第 6、7.3 節
const HEADER_HEIGHT = 64;
const SIDER_WIDTH = 208;
const SIDER_COLLAPSED_WIDTH = 56;
const CONTENT_PADDING = 24;
const SCROLL_BLUR_THRESHOLD = 4;

export interface BackOfficeMenuItem {
  /** 側欄裡唯一的 key；沒有 path 時也是路由路徑 */
  key: string;
  /** 路由路徑，也是選取判斷的前綴（同一頁出現在「釘選」「最近使用」時，key 不同、path 相同） */
  path?: string;
  label: string;
  icon: ReactNode;
  /** 數字徽章；分類收起時，分類標題顯示底下項目的加總 */
  badge?: number;
  /** 有子項目＝可收合的分類 */
  children?: BackOfficeMenuItem[];
}

const pathOf = (item: BackOfficeMenuItem) => item.path ?? item.key;
const leavesOf = (items: BackOfficeMenuItem[]): BackOfficeMenuItem[] =>
  items.flatMap((item) => (item.children ? leavesOf(item.children) : [item]));

function readOpenState(storageKey: string | undefined): Record<string, boolean> {
  if (!storageKey) return {};
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export interface BackOfficeShellProps {
  /** 側欄導覽（可含分類） */
  menuItems: BackOfficeMenuItem[];
  /** 沒有紀錄時預設展開的分類 */
  defaultOpenKeys?: string[];
  /** 記住分類展開／收起的瀏覽器儲存 key；沒給就不記 */
  openStateStorageKey?: string;
  /** 已釘選的路徑；和 onTogglePin 一起給才顯示釘選按鈕 */
  pinnedPaths?: string[];
  onTogglePin?: (path: string) => void;
  /** 側欄頂端品牌名稱 */
  brandName: string;
  /** 品牌 LOGO；沒有時顯示品牌名稱首字 */
  brandLogoUrl?: string | null;
  /** Header 左側的登入者說明，例如「admin（管理員）」 */
  userLabel: ReactNode;
  /** Header 右側登入者旁的額外內容（例如帳號設定連結） */
  headerExtra?: ReactNode;
  onLogout: () => void;
}

/**
 * 後台共用外框：固定 Header（捲動後毛玻璃）＋可收合側欄＋頁面底部操作列。
 * 健身房管理員（AppLayout）與平台管理後台（platform/PlatformLayout）都用這一個外框，
 * 只換導覽、品牌與登入者資訊——見 layout-conventions skill。
 */
export default function BackOfficeShell({
  menuItems,
  defaultOpenKeys = [],
  openStateStorageKey,
  pinnedPaths,
  onTogglePin,
  brandName,
  brandLogoUrl,
  userLabel,
  headerExtra,
  onLogout,
}: BackOfficeShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const actionBarContent = usePageActionBarStore((s) => s.content);
  const [collapsed, setCollapsed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const brandInitial = brandName.charAt(0).toUpperCase();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > SCROLL_BLUR_THRESHOLD);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const leaves = useMemo(() => leavesOf(menuItems), [menuItems]);
  // 最長前綴優先，讓 /platform/tenants/new、/admin/members/12 之類的子頁仍選到正確的導覽
  const selectedPath = [...leaves]
    .map(pathOf)
    .sort((a, b) => b.length - a.length)
    .find((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  const selectedKeys = leaves.filter((item) => pathOf(item) === selectedPath).map((item) => item.key);

  // 分類展開狀態：使用者自己點開／收起的記在瀏覽器，沒點過的照 defaultOpenKeys
  const [openState, setOpenState] = useState<Record<string, boolean>>(() => readOpenState(openStateStorageKey));
  // 換頁時暫時展開這一頁所在的分類；離開這一頁就收回，側欄不會越開越長
  const [autoOpenKey, setAutoOpenKey] = useState<string | null>(null);
  const groups = menuItems.filter((item) => item.children);
  const keptOpen = (key: string) => openState[key] ?? defaultOpenKeys.includes(key);
  const openKeys = groups.filter((g) => g.key === autoOpenKey || keptOpen(g.key)).map((g) => g.key);
  const saveOpenState = (next: Record<string, boolean>) => {
    setOpenState(next);
    if (!openStateStorageKey) return;
    try {
      localStorage.setItem(openStateStorageKey, JSON.stringify(next));
    } catch {
      // 無痕視窗或封鎖網站資料：只在這次有效
    }
  };

  useEffect(() => {
    // 這一頁已經看得到（不分類、釘選或展開中的分類裡）就不用再展開
    const visible = menuItems.some((item) =>
      item.children
        ? keptOpen(item.key) && item.children.some((c) => pathOf(c) === selectedPath)
        : pathOf(item) === selectedPath,
    );
    const owner = groups.find((g) => g.children!.some((c) => pathOf(c) === selectedPath));
    setAutoOpenKey(!selectedPath || visible ? null : (owner?.key ?? null));
    // 只在換頁（或選單第一次載入）時判斷，使用者之後收起也不會被打開
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath, menuItems.length > 0]);

  const pinned = new Set(pinnedPaths ?? []);
  const toItem = (item: BackOfficeMenuItem): NonNullable<MenuProps['items']>[number] => {
    if (item.children) {
      const total = item.children.reduce((sum, c) => sum + (c.badge ?? 0), 0);
      return {
        key: item.key,
        icon: item.icon,
        // 分類收起時把底下的數字顯示在分類上，才不會漏看
        label: <BackOfficeMenuLabel compact={collapsed} label={item.label} badge={openKeys.includes(item.key) ? 0 : total} />,
        children: item.children.map(toItem),
      };
    }
    const path = pathOf(item);
    return {
      key: item.key,
      icon: item.icon,
      title: item.label,
      label: (
        <BackOfficeMenuLabel
          compact={collapsed}
          label={item.label}
          badge={item.badge}
          pinned={pinned.has(path)}
          onTogglePin={onTogglePin && !collapsed ? () => onTogglePin(path) : undefined}
        />
      ),
    };
  };
  const items: MenuProps['items'] = menuItems.map(toItem);
  const pathByKey = new Map(leaves.map((item) => [item.key, pathOf(item)]));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="light"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={SIDER_COLLAPSED_WIDTH}
        width={SIDER_WIDTH}
        style={{ borderRight: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div
          style={{
            height: HEADER_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            padding: collapsed ? 0 : '0 20px',
            overflow: 'hidden',
          }}
        >
          {brandLogoUrl ? (
            <img
              src={brandLogoUrl}
              alt=""
              style={{ width: 28, height: 28, flex: 'none', borderRadius: token.borderRadiusSM, objectFit: 'contain' }}
            />
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                flex: 'none',
                borderRadius: token.borderRadiusSM,
                background: token.colorPrimary,
                color: token.colorWhite,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {brandInitial}
            </div>
          )}
          {!collapsed && (
            <span
              style={{
                fontWeight: 600,
                fontSize: 16,
                color: token.colorText,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {brandName}
            </span>
          )}
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={selectedKeys}
          // 側欄收成圖示時，分類改成滑過彈出，不套用展開狀態
          {...(collapsed ? {} : { openKeys })}
          onOpenChange={(keys) => {
            if (collapsed) return;
            // 只記下這次被點的分類
            const next = { ...openState };
            for (const g of groups) {
              if (openKeys.includes(g.key) !== keys.includes(g.key)) next[g.key] = keys.includes(g.key);
            }
            if (autoOpenKey && !keys.includes(autoOpenKey)) setAutoOpenKey(null);
            saveOpenState(next);
          }}
          items={items}
          onClick={({ key }) => navigate(pathByKey.get(key) ?? key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            height: HEADER_HEIGHT,
            lineHeight: `${HEADER_HEIGHT}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            // 毛玻璃是 Header 專屬的例外（見 layout-conventions skill），半透明值不另設 token
            background: scrolled ? 'rgba(255,255,255,0.45)' : token.colorBgContainer,
            backdropFilter: scrolled ? 'blur(18px) saturate(180%)' : 'none',
            WebkitBackdropFilter: scrolled ? 'blur(18px) saturate(180%)' : 'none',
            boxShadow: scrolled ? '0 1px 4px rgba(0,21,41,0.08)' : 'none',
            borderBottom: scrolled ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
            transition: 'background .25s, box-shadow .25s',
          }}
        >
          <Typography.Text>{userLabel}</Typography.Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {headerExtra}
            <Button onClick={onLogout}>登出</Button>
          </div>
        </Header>
        <Content style={{ margin: CONTENT_PADDING }}>
          <Outlet />
        </Content>
        {actionBarContent ? (
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              zIndex: 10,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              padding: '14px 24px',
              background: token.colorBgContainer,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              boxShadow: token.boxShadowSecondary,
            }}
          >
            {actionBarContent}
          </div>
        ) : null}
      </Layout>
    </Layout>
  );
}

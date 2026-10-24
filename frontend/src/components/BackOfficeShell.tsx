import { useEffect, useState, type ReactNode } from 'react';
import { Layout, Menu, Button, Typography, theme, type MenuProps } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { usePageActionBarStore } from '../store/pageActionBar';

const { Header, Sider, Content } = Layout;

// 版面度量與毛玻璃效果數值，對應 gym-system-design/DESIGN_GUIDELINES.md 第 6、7.3 節
const HEADER_HEIGHT = 64;
const SIDER_WIDTH = 208;
const SIDER_COLLAPSED_WIDTH = 56;
const CONTENT_PADDING = 24;
const SCROLL_BLUR_THRESHOLD = 4;

export interface BackOfficeMenuItem {
  /** 路由路徑，也是選取判斷的前綴 */
  key: string;
  label: ReactNode;
  icon: ReactNode;
}

export interface BackOfficeShellProps {
  /** 側欄導覽 */
  menuItems: BackOfficeMenuItem[];
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

  // 最長前綴優先，讓 /platform/tenants/new 之類的子頁仍選到正確的導覽
  const selectedKey = [...menuItems]
    .sort((a, b) => b.key.length - a.key.length)
    .find((item) => location.pathname.startsWith(item.key))?.key;
  const items: MenuProps['items'] = menuItems.map(({ key, label, icon }) => ({ key, label, icon }));

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
          selectedKeys={selectedKey ? [selectedKey] : []}
          items={items}
          onClick={({ key }) => navigate(key)}
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

import React from 'react';
// 整個 App 的版型外框：左側依角色顯示選單、頂部黏著式頁首（捲動時轉為毛玻璃）。
// 受控元件 —— 路由與登入狀態由父層透過 props 提供（正式 App 接 react-router 與 auth store）。
// 版面度量對應 gym-system-design/DESIGN_GUIDELINES.md 第 6、7.3 節。
const HEADER_HEIGHT = 64;
const SIDER_WIDTH = 208;
const SIDER_COLLAPSED_WIDTH = 56;
const CONTENT_PADDING = 24;
const ADMIN_MENU = [
  { key: '/admin/dashboard', label: '儀表板', icon: 'ri-dashboard-line' },
  { key: '/admin/reservations', label: '預約審核', icon: 'ri-file-list-3-line' },
  { key: '/admin/coaches', label: '教練管理', icon: 'ri-user-star-line' },
  { key: '/admin/products', label: '商品管理', icon: 'ri-shopping-bag-3-line' },
  { key: '/admin/courses', label: '課程管理', icon: 'ri-calendar-line' },
  { key: '/admin/members', label: '會員管理', icon: 'ri-team-line' },
  { key: '/admin/slot-settings', label: '時段設定', icon: 'ri-time-line' },
  { key: '/admin/settings', label: '系統設定', icon: 'ri-settings-3-line' },
];
const MEMBER_MENU = [
  { key: '/member/dashboard', label: '儀表板', icon: 'ri-dashboard-line' },
  { key: '/member/products', label: '我的商品', icon: 'ri-shopping-bag-3-line' },
  { key: '/member/bookings', label: '我的預約', icon: 'ri-calendar-line' },
];
export function AppLayout(props) {
  const {
    role = 'admin', username = '', isCoach = false, activeKey,
    scrolled = false, defaultCollapsed = false, onNavigate, onLogout, children,
    brandName = '健身工作室管理系統', brandLogoUrl,
  } = props;
  const ns = (typeof window !== 'undefined' && window.PulseFitDesignSystem_325e30) || {};
  const Menu = ns.Menu;
  const Button = ns.Button;
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const items = role === 'admin' ? ADMIN_MENU : MEMBER_MENU;
  const roleLabel = role === 'admin' ? '管理員' : (isCoach ? '場租教練' : '學員');
  const brandInitial = (brandName || '').charAt(0).toUpperCase();
  return React.createElement('div', {
    style: { display: 'flex', minHeight: '100%', fontFamily: 'var(--font-family)', background: 'var(--bg-layout)' },
  },
    React.createElement('div', {
      style: {
        width: collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH, flexShrink: 0,
        background: 'var(--sider-bg)', borderRight: '1px solid var(--sider-border)',
        display: 'flex', flexDirection: 'column', transition: 'width .2s',
      },
    },
      React.createElement('div', {
        style: {
          height: HEADER_HEIGHT, display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start', gap: 10,
          padding: collapsed ? 0 : '0 20px', overflow: 'hidden',
        },
      },
        brandLogoUrl
          ? React.createElement('img', {
              src: brandLogoUrl, alt: '',
              style: { width: 28, height: 28, flexShrink: 0, borderRadius: 'var(--radius-sm)', objectFit: 'contain' },
            })
          : React.createElement('div', {
              style: {
                width: 28, height: 28, flexShrink: 0, borderRadius: 'var(--radius-sm)',
                background: 'var(--color-primary)', color: '#fff', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
              },
            }, brandInitial),
        !collapsed && React.createElement('span', {
          style: {
            fontWeight: 600, fontSize: 16, color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          },
        }, brandName),
      ),
      Menu && React.createElement(Menu, {
        items: items, activeKey: activeKey, collapsed: collapsed,
        onChange: (key) => onNavigate && onNavigate(key),
      }),
      React.createElement('div', {
        onClick: () => setCollapsed((c) => !c),
        style: {
          marginTop: 'auto', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-secondary)',
        },
      }, React.createElement('i', {
        className: collapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line', style: { fontSize: 16 },
      })),
    ),
    React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 } },
      React.createElement('div', {
        style: {
          position: 'sticky', top: 0, zIndex: 10, height: HEADER_HEIGHT, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
          background: scrolled ? 'rgba(255,255,255,0.45)' : 'var(--header-bg)',
          backdropFilter: scrolled ? 'blur(18px) saturate(180%)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(18px) saturate(180%)' : 'none',
          boxShadow: scrolled ? 'var(--shadow-header)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
          transition: 'background .25s, box-shadow .25s',
        },
      },
        React.createElement('span', { style: { color: 'var(--text-secondary)', fontSize: 14 } },
          username + '（' + roleLabel + '）'),
        Button && React.createElement(Button, { onClick: () => onLogout && onLogout() }, '登出'),
      ),
      React.createElement('div', { style: { margin: CONTENT_PADDING, flex: 1 } }, children),
    ),
  );
}

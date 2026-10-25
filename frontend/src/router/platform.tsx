import { createBrowserRouter, Navigate } from 'react-router-dom';
import PlatformLayout from '../components/platform/PlatformLayout';
import PlatformLogin from '../pages/platform/Login';
import TenantList from '../pages/platform/TenantList';
import TenantForm from '../pages/platform/TenantForm';
import TenantDetail from '../pages/platform/TenantDetail';
import AuditLogs from '../pages/platform/AuditLogs';
import LineNotifications from '../pages/platform/LineNotifications';
import Account from '../pages/platform/Account';

/**
 * 平台管理後台的路由（只在 platform.<主網域> 使用，見 App.tsx 與 docs/adr/0002-platform-console.md）。
 * 與健身房的路由完全分開；未登入時 PlatformLayout 導向 /login。以函式建立，只在平台網址才建立。
 */
export const createPlatformRouter = () =>
  createBrowserRouter([
    { path: '/login', element: <PlatformLogin /> },
    {
      element: <PlatformLayout />,
      children: [
        { path: '/', element: <Navigate to="/tenants" replace /> },
        { path: '/tenants', element: <TenantList /> },
        { path: '/tenants/new', element: <TenantForm /> },
        { path: '/tenants/:id', element: <TenantDetail /> },
        { path: '/line', element: <LineNotifications /> },
        { path: '/audit-logs', element: <AuditLogs /> },
        { path: '/account', element: <Account /> },
      ],
    },
    { path: '*', element: <Navigate to="/tenants" replace /> },
  ]);

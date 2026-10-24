import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, type Role } from '../store/auth';

/**
 * 路由守衛：未登入導向登入頁；角色不符（例如會員嘗試進入 /admin/*）導向自己的首頁。
 * 不指定 role 時只要求已登入（例如修改密碼頁：管理員與會員都可能被要求先改密碼）。
 */
export default function RequireRole({ role }: { role?: Role }) {
  const { token, role: currentRole } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role && currentRole !== role) {
    return <Navigate to={currentRole === 'admin' ? '/admin/dashboard' : '/member/dashboard'} replace />;
  }

  return <Outlet />;
}

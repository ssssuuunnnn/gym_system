import type { ReactNode } from 'react';
import { Button, Result, Spin } from 'antd';
import { Navigate, useNavigate } from 'react-router-dom';
import { allows, firstAllowedPath, type MenuPermission } from '../components/adminMenu';
import { usePermissions } from '../lib/permissions';

/**
 * 後台頁面的功能權限守衛（ADR 0008）：沒有權限時顯示 403；首頁（儀表板）沒權限則帶到第一個能用的頁面。
 * 只是畫面上的保護，API 本身也會擋。
 */
export default function RequirePerm({ perm, landing, children }: { perm: MenuPermission; landing?: boolean; children: ReactNode }) {
  const navigate = useNavigate();
  const { isLoading, can, isOwner } = usePermissions();
  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (allows(perm, can, isOwner)) return <>{children}</>;
  const home = firstAllowedPath(can, isOwner);
  if (landing && home) return <Navigate to={home} replace />;
  return (
    <Result
      status="403"
      title="沒有權限"
      subTitle={home ? '你的帳號沒有這個功能的權限，需要的話請洽主要管理者。' : '你的帳號還沒有任何功能權限，請洽主要管理者。'}
      extra={
        home ? (
          <Button type="primary" onClick={() => navigate(home)}>
            回到可用的頁面
          </Button>
        ) : undefined
      }
    />
  );
}

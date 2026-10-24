import { theme } from 'antd';
import {
  RightOutlined,
  ShoppingOutlined,
  ShoppingCartOutlined,
  LockOutlined,
  LogoutOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getMyCoachProfile } from '../../api/coaches';
import { useAuthStore } from '../../store/auth';
import FrontPageHeader from '../../components/member/FrontPageHeader';
import FrontCard from '../../components/member/FrontCard';
import type { FrontMode } from '../../components/member/memberTheme';

export interface MeProps {
  /** 目前在會員前台或教練前台 */
  mode: FrontMode;
}

interface Entry {
  to: string;
  label: string;
  icon: ReactNode;
  hint?: string;
}

/** 前台「我的」：帳號、方案與訂單、購買、修改密碼、會員／教練模式切換、登出。會員與教練共用。 */
export default function Me({ mode }: MeProps) {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { username, isCoach, logout } = useAuthStore();
  const { data: profile } = useQuery({ queryKey: ['my-coach-profile'], queryFn: getMyCoachProfile, enabled: isCoach });

  const entries: Entry[] = [
    ...(mode === 'member'
      ? [
          { to: '/member/products', label: '我的方案與訂單', icon: <ShoppingOutlined />, hint: '剩餘堂數、付款狀態' },
          { to: '/member/purchase', label: '購買方案', icon: <ShoppingCartOutlined /> },
        ]
      : []),
    { to: '/member/change-password', label: '修改密碼', icon: <LockOutlined /> },
    ...(isCoach
      ? [
          mode === 'member'
            ? { to: '/coach/today', label: '切換到教練模式', icon: <SwapOutlined />, hint: '今日課表、學員簽到' }
            : { to: '/member/dashboard', label: '切換到會員模式', icon: <SwapOutlined />, hint: '以學員身份預約上課' },
        ]
      : []),
  ];

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate('/login');
  };

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    padding: '8px 16px',
    color: token.colorText,
    textDecoration: 'none',
    fontSize: 15,
    width: '100%',
    boxSizing: 'border-box',
    border: 'none',
    background: 'transparent',
    fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
  } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FrontPageHeader title="我的" />

      <FrontCard style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span
          aria-hidden="true"
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            background: token.colorPrimary,
            color: token.colorTextLightSolid,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          {(username ?? '?').charAt(0).toUpperCase()}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{username}</span>
          <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
            {isCoach ? profile?.coach_types.join('・') ?? '教練' : '學員'}
          </span>
        </div>
      </FrontCard>

      <FrontCard padding={0} style={{ overflow: 'hidden' }}>
        <nav aria-label="帳號功能">
          {entries.map((e, i) => (
            <Link key={e.to} to={e.to} style={{ ...rowStyle, borderTop: i ? `1px solid ${token.colorBorderSecondary}` : 'none' }}>
              <span aria-hidden="true" style={{ fontSize: 18, color: token.colorPrimary }}>
                {e.icon}
              </span>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {e.label}
                {e.hint && <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{e.hint}</span>}
              </span>
              <RightOutlined aria-hidden="true" style={{ fontSize: 12, color: token.colorTextSecondary }} />
            </Link>
          ))}
        </nav>
      </FrontCard>

      <FrontCard padding={0} style={{ overflow: 'hidden' }}>
        <button type="button" onClick={handleLogout} style={{ ...rowStyle, color: token.colorError }}>
          <LogoutOutlined aria-hidden="true" style={{ fontSize: 18 }} />
          登出
        </button>
      </FrontCard>
    </div>
  );
}

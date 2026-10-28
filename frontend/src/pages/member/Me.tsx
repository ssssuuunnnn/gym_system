import { App, Popconfirm, Switch, theme } from 'antd';
import {
  RightOutlined,
  ShoppingOutlined,
  ShoppingCartOutlined,
  LockOutlined,
  LogoutOutlined,
  SwapOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getMyCoachProfile } from '../../api/coaches';
import { getMe } from '../../api/users';
import { lineUnlink, setLinePreferences } from '../../api/lineOa';
import { apiErrorMessage } from '../../api/errors';
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

/**
 * 前台「我的」：帳號、方案與訂單、購買、修改密碼、會員／教練模式切換、LINE 綁定、登出。會員與教練共用。
 * 在 LINE 裡（inLine）不顯示修改密碼與登出；只用 LINE 加入、沒有密碼的會員不能自己解除綁定。
 */
export default function Me({ mode }: MeProps) {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { username, isCoach, logout, inLine } = useAuthStore();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe });
  const unlinkMutation = useMutation({
    mutationFn: lineUnlink,
    onSuccess: () => {
      message.success('已解除 LINE 綁定');
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });
  const notifyMutation = useMutation({
    mutationFn: (on: boolean) => setLinePreferences({ line_notify: on }),
    onSuccess: (_res, on) => {
      message.success(on ? '已開啟 LINE 通知' : '已關閉 LINE 通知');
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });
  const marketingMutation = useMutation({
    mutationFn: (on: boolean) => setLinePreferences({ marketing_consent: on }),
    onSuccess: (_res, on) => {
      message.success(on ? '已開啟優惠與活動訊息' : '已關閉優惠與活動訊息');
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });
  // 在 LINE 裡、或只用 LINE 加入（沒有密碼）時不顯示修改密碼與登出
  const passwordAccount = !inLine && me?.has_password !== false;
  const { data: profile } = useQuery({ queryKey: ['my-coach-profile'], queryFn: getMyCoachProfile, enabled: isCoach });

  const entries: Entry[] = [
    ...(mode === 'member'
      ? [
          { to: '/member/products', label: '我的方案與訂單', icon: <ShoppingOutlined />, hint: '剩餘堂數、付款狀態' },
          { to: '/member/purchase', label: '購買方案', icon: <ShoppingCartOutlined /> },
        ]
      : []),
    ...(passwordAccount ? [{ to: '/member/change-password', label: '修改密碼', icon: <LockOutlined /> }] : []),
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
          {(me?.display_name || username || '?').charAt(0).toUpperCase()}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{me?.display_name || username}</span>
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

      {me?.line_linked && (
        <FrontCard style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <MessageOutlined aria-hidden="true" style={{ fontSize: 18, color: token.colorSuccess }} />
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            LINE 已綁定
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
              {me.line_display_name ?? 'LINE 使用者'}・在健身房的 LINE 官方帳號裡自動登入
            </span>
          </span>
          {passwordAccount && (
            <Popconfirm
              title="解除 LINE 綁定？"
              description="之後要在 LINE 裡重新用帳號密碼綁定。"
              okText="解除"
              cancelText="取消"
              onConfirm={() => unlinkMutation.mutateAsync()}
            >
              <button type="button" style={{ border: 'none', background: 'transparent', color: token.colorError, fontSize: 14, cursor: 'pointer', minHeight: 44 }}>
                解除綁定
              </button>
            </Popconfirm>
          )}
        </FrontCard>
      )}

      {me?.line_linked && (
        <FrontCard style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <label htmlFor="line-notify" style={{ flex: 1, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
            LINE 通知
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>預約結果、上課提醒、收款確認</span>
          </label>
          <Switch
            id="line-notify"
            checked={me.line_notify}
            loading={notifyMutation.isPending}
            onChange={(on) => notifyMutation.mutate(on)}
          />
        </FrontCard>
      )}

      {me?.line_linked && (
        <FrontCard style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <label htmlFor="line-marketing" style={{ flex: 1, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
            優惠與活動訊息
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>新課程、優惠方案、活動消息（隨時可以關閉）</span>
          </label>
          <Switch
            id="line-marketing"
            checked={me.marketing_consent}
            loading={marketingMutation.isPending}
            onChange={(on) => marketingMutation.mutate(on)}
          />
        </FrontCard>
      )}

      {!inLine && (
        <FrontCard padding={0} style={{ overflow: 'hidden' }}>
          <button type="button" onClick={handleLogout} style={{ ...rowStyle, color: token.colorError }}>
            <LogoutOutlined aria-hidden="true" style={{ fontSize: 18 }} />
            登出
          </button>
        </FrontCard>
      )}
    </div>
  );
}

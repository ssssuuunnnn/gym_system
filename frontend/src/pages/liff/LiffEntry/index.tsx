import { useEffect, useRef, useState } from 'react';
import { App, Button, ConfigProvider, Result, Spin, theme } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { getLineOaPublic, lineLogin, type LineOaPublic, type LoginToken } from '../../../api/lineOa';
import { apiClient } from '../../../api/client';
import { apiErrorMessage } from '../../../api/errors';
import type { Member } from '../../../api/users';
import { FRONT_MAX_WIDTH, FRONT_THEMES } from '../../../components/member/memberTheme';
import { useAuthStore } from '../../../store/auth';
import { JoinPanel } from './components/JoinPanel';
import { devMockIdToken, liffTarget } from './lib';
import { useShopTitle } from '../../../lib/usePageTitle';

type State =
  | { kind: 'loading' }
  | { kind: 'disabled'; info: LineOaPublic }
  | { kind: 'error'; message: string }
  | { kind: 'unlinked'; info: LineOaPublic; linkToken: string; lineName: string | null };

/** 取得 LINE 的 ID token：LIFF SDK 只在這頁動態載入；未登入時 liff.login() 會跳轉，回傳 null。 */
async function getIdToken(liffId: string): Promise<string | null> {
  const mock = devMockIdToken();
  if (mock) return mock;
  const { default: liff } = await import('@line/liff');
  await liff.init({ liffId });
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    return null;
  }
  const idToken = liff.getIDToken();
  if (!idToken) throw new Error('無法取得 LINE 登入資料，請確認 LIFF 的 Scope 有勾選 openid');
  return idToken;
}

/**
 * LIFF 入口 /liff/*（見 docs/adr/0005-gym-line-oa.md）：在健身房的 LINE 官方帳號裡打開。
 * 用 LINE 登入 → 已綁定就直接進會員前台對應頁面；否則顯示「加入會員／我已經是會員」。
 */
function LiffEntryInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const login = useAuthStore((s) => s.login);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const target = useRef(liffTarget(location.pathname, location.search));

  const finish = async (token: LoginToken) => {
    // 取帳號名稱（前台顯示用）；這時 store 還沒有 token，所以自己帶
    const { data: me } = await apiClient.get<Member>('/auth/me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    login({
      token: token.access_token,
      role: token.role,
      isCoach: token.is_coach,
      username: me.display_name || me.username,
      mustChangePassword: token.must_change_password,
      inLine: true,
    });
    navigate(target.current, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await getLineOaPublic();
        if (!info.enabled || !info.liff_id) {
          if (!cancelled) setState({ kind: 'disabled', info });
          return;
        }
        const idToken = await getIdToken(info.liff_id);
        if (!idToken || cancelled) return; // 正在跳轉到 LINE 登入
        const result = await lineLogin(idToken);
        if (cancelled) return;
        if (result.status === 'ok' && result.token) {
          await finish(result.token);
        } else if (result.link_token) {
          setState({ kind: 'unlinked', info, linkToken: result.link_token, lineName: result.line_display_name });
        }
      } catch (err) {
        if (!cancelled) setState({ kind: 'error', message: err instanceof Error && !('isAxiosError' in err) ? err.message : apiErrorMessage(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (state.kind === 'loading') {
    return (
      <div style={{ padding: '30vh 0', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>正在用 LINE 登入…</div>
      </div>
    );
  }
  if (state.kind === 'disabled') {
    return <Result status="info" title={`${state.info.gym_name}尚未開放 LINE 會員`} subTitle="請洽櫃台，或改用網頁登入。" />;
  }
  if (state.kind === 'error') {
    return (
      <Result
        status="error"
        title="LINE 登入失敗"
        subTitle={state.message}
        extra={
          <Button type="primary" onClick={() => { setState({ kind: 'loading' }); setAttempt((n) => n + 1); }}>
            再試一次
          </Button>
        }
      />
    );
  }
  return (
    <JoinPanel
      gymName={state.info.gym_name}
      linkToken={state.linkToken}
      lineDisplayName={state.lineName}
      onDone={(token) => {
        message.success('歡迎！');
        finish(token).catch((err) => message.error(apiErrorMessage(err)));
      }}
    />
  );
}

export default function LiffEntry() {
  useShopTitle();
  return (
    <ConfigProvider theme={FRONT_THEMES.member}>
      <App>
        <LiffShell>
          <LiffEntryInner />
        </LiffShell>
      </App>
    </ConfigProvider>
  );
}

function LiffShell({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  return (
    <div style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <main style={{ maxWidth: FRONT_MAX_WIDTH, margin: '0 auto', padding: '24px 16px 40px', boxSizing: 'border-box' }}>
        {children}
      </main>
    </div>
  );
}

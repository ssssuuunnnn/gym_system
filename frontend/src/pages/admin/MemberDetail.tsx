import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Input,
  Radio,
  Result,
  Skeleton,
  Switch,
  Tag,
  Typography,
  message,
  theme,
} from 'antd';
import type { RadioChangeEvent } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import {
  getMember,
  resetMemberPassword,
  setMemberBlacklist,
  updateMemberUsername,
} from '../../api/users';

const { Text } = Typography;

/** 與設計稿一致的不易混淆字元隨機密碼（10 碼）。 */
function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 10; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function fmt(value: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—';
}

/**
 * 會員詳情：對應「會員管理 → 會員列表 → 會員詳情」。
 * 帳號、密碼與黑名單狀態皆由管理員維護，儲存時依實際變更分別呼叫對應 API。
 */
export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const memberId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();

  const { data: member, isLoading } = useQuery({
    queryKey: ['member', memberId],
    queryFn: () => getMember(memberId),
  });

  const [username, setUsername] = useState('');
  const [pwdMode, setPwdMode] = useState<'keep' | 'reset'>('keep');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [mustChange, setMustChange] = useState(true);
  const [blacklisted, setBlacklisted] = useState<boolean | null>(null);

  // 僅在載入到（或切換至）另一位會員時重設表單，避免背景重新整理把使用者的編輯清掉
  useEffect(() => {
    if (member) {
      setUsername(member.username);
      setPwdMode('keep');
      setPwd('');
      setPwd2('');
      setMustChange(true);
      setBlacklisted(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id]);

  const reset = pwdMode === 'reset';
  const black = blacklisted === null ? !!member?.is_blacklisted : blacklisted;
  const usernameEmpty = username.trim() === '';
  const shortPwd = reset && pwd.length > 0 && pwd.length < 8;
  const mismatch = reset && pwd2.length > 0 && pwd !== pwd2;
  const pwdOk = reset && pwd.length >= 8 && pwd === pwd2;

  let pwdNote = '兩次輸入需一致，儲存後立即生效';
  let pwdNoteColor: string = token.colorTextTertiary;
  if (mismatch) {
    pwdNote = '兩次輸入的密碼不一致';
    pwdNoteColor = token.colorError;
  } else if (shortPwd) {
    pwdNote = '密碼長度需至少 8 碼';
    pwdNoteColor = token.colorError;
  } else if (pwdOk) {
    pwdNote = '密碼已可儲存';
    pwdNoteColor = token.colorSuccess;
  }

  const changes = useMemo(() => {
    if (!member) return [] as string[];
    const list: string[] = [];
    if (username !== member.username) list.push('帳號');
    if (reset) list.push('密碼');
    if (black !== !!member.is_blacklisted) list.push('黑名單狀態');
    return list;
  }, [member, username, reset, black]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!member) return;
      if (username.trim() !== member.username) {
        await updateMemberUsername(member.id, username.trim());
      }
      if (reset) {
        await resetMemberPassword(member.id, {
          new_password: pwd,
          must_change_password: mustChange,
        });
      }
      if (black !== !!member.is_blacklisted) {
        await setMemberBlacklist(member.id, black);
      }
    },
    onSuccess: () => {
      message.success('已儲存變更');
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member', memberId] });
      navigate('/admin/members');
    },
    onError: (error) => {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      message.error(typeof detail === 'string' ? detail : '儲存失敗，請稍後再試');
    },
  });

  if (isLoading) {
    return (
      <Card>
        <Skeleton active />
      </Card>
    );
  }

  if (!member) {
    return (
      <Card>
        <Result
          status="404"
          title="找不到此會員"
          extra={
            <Button type="primary" onClick={() => navigate('/admin/members')}>
              返回會員列表
            </Button>
          }
        />
      </Card>
    );
  }

  const labelCol: React.CSSProperties = {
    width: 96,
    flex: 'none',
    textAlign: 'right',
    fontSize: 14,
    color: token.colorText,
  };
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12 };
  const required = <span style={{ color: token.colorError, marginRight: 4 }}>*</span>;

  const saveDisabled = (reset && !pwdOk) || usernameEmpty || changes.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Breadcrumb items={[{ title: '會員管理' }, { title: '會員列表' }, { title: '會員詳情' }]} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.3 }}>會員詳情</div>
          <div style={{ fontSize: 13, color: token.colorTextTertiary, paddingBottom: 4 }}>
            帳號、密碼與黑名單狀態皆由管理員維護
          </div>
        </div>
      </div>

      {black && (
        <Alert
          type="error"
          showIcon
          message="此會員目前列入黑名單"
          description="會員登入時將收到「帳號已被列入黑名單」提示，且無法送出預約或使用 App 功能。"
        />
      )}

      <Card title="會員資料" extra={`會員編號 #${member.id}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 840 }}>
          <div style={row}>
            <div style={labelCol}>
              {required}帳號
            </div>
            <Input
              style={{ width: 320 }}
              placeholder="會員登入帳號"
              value={username}
              status={usernameEmpty ? 'error' : undefined}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Text style={{ fontSize: 13 }} type="secondary">
              {usernameEmpty ? '帳號不可空白' : '帳號須為系統內唯一值，變更後會員需以新帳號登入'}
            </Text>
          </div>

          <div style={row}>
            <div style={labelCol}>身份</div>
            <Tag color={member.is_coach ? 'blue' : 'default'}>{member.is_coach ? '場租教練' : '學員'}</Tag>
            <Text style={{ fontSize: 13 }} type="secondary">
              由教練資料綁定衍生，需至教練管理調整
            </Text>
          </div>

          <div style={row}>
            <div style={labelCol}>加入時間</div>
            <div style={{ fontSize: 14 }}>{fmt(member.created_at)}</div>
          </div>

          <div style={row}>
            <div style={labelCol}>最後操作時間</div>
            <div style={{ fontSize: 14 }}>{fmt(member.last_login_at)}</div>
          </div>
        </div>
      </Card>

      <Card title="登入密碼" extra={reset ? '將於儲存時重設' : '未變更'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 840 }}>
          <div style={{ ...row, gap: 24 }}>
            <div style={labelCol}>密碼</div>
            <Radio.Group
              value={pwdMode}
              onChange={(e: RadioChangeEvent) => setPwdMode(e.target.value)}
            >
              <Radio value="keep">不變更密碼</Radio>
              <Radio value="reset">由管理員設定新密碼</Radio>
            </Radio.Group>
          </div>

          {reset && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                padding: 16,
                background: token.colorFillAlter,
                borderRadius: token.borderRadius,
              }}
            >
              <div style={row}>
                <div style={{ ...labelCol, width: 80 }}>
                  {required}新密碼
                </div>
                <Input.Password
                  style={{ width: 320 }}
                  placeholder="請輸入 8 碼以上新密碼"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                />
                <Button
                  size="small"
                  type="link"
                  onClick={() => {
                    setPwd(randomPassword());
                    setPwd2('');
                  }}
                >
                  產生隨機密碼
                </Button>
              </div>

              <div style={row}>
                <div style={{ ...labelCol, width: 80 }}>
                  {required}確認密碼
                </div>
                <Input.Password
                  style={{ width: 320 }}
                  placeholder="再次輸入新密碼"
                  value={pwd2}
                  status={mismatch ? 'error' : undefined}
                  onChange={(e) => setPwd2(e.target.value)}
                />
                <span style={{ fontSize: 13, color: pwdNoteColor }}>{pwdNote}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 80, flex: 'none' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Checkbox
                    checked={mustChange}
                    onChange={(e) => setMustChange(e.target.checked)}
                  >
                    會員下次登入時必須自行修改密碼
                  </Checkbox>
                  <div style={{ fontSize: 12, color: token.colorTextTertiary, paddingLeft: 24 }}>
                    {mustChange
                      ? '會員以此密碼登入後會被導向修改密碼頁，未完成設定前無法使用其他功能。'
                      : '會員可持續使用管理員設定的密碼，不會被要求修改。'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!reset && (
            <div style={row}>
              <div style={labelCol} />
              <Text style={{ fontSize: 13 }} type="secondary">
                儲存時不會送出密碼變更，會員沿用現有密碼登入。
              </Text>
            </div>
          )}
        </div>
      </Card>

      <Card title="黑名單狀態">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Switch checked={black} onChange={(checked) => setBlacklisted(checked)} />
          <Tag color={black ? 'error' : 'success'}>{black ? '已列入黑名單' : '正常'}</Tag>
          <Text style={{ fontSize: 13 }} type="secondary">
            {black
              ? '解除後會員即可恢復登入與預約'
              : '開啟後會員將無法登入、預約，既有預約需另行處理'}
          </Text>
        </div>
      </Card>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 24px',
          margin: '0 -24px -24px',
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: token.boxShadowSecondary,
        }}
      >
        <span style={{ fontSize: 13, color: token.colorTextTertiary }}>
          {changes.length ? `待儲存：${changes.join('、')}` : '尚無變更'}
        </span>
        <div style={{ flex: 1 }} />
        <Button onClick={() => navigate('/admin/members')}>取消</Button>
        <Button
          type="primary"
          disabled={saveDisabled}
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          儲存變更
        </Button>
      </div>
    </div>
  );
}

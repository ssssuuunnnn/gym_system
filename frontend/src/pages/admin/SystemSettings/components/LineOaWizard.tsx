import { useEffect, useState } from 'react';
import { Alert, Button, Input, List, Modal, Result, Steps, Typography, theme } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, ExclamationCircleFilled } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import {
  saveLineOa,
  verifyLineOa,
  type LineOaCheck,
  type LineOaSettings,
  type LineOaVerifyResult,
} from '../../../../api/lineOa';
import { apiErrorMessage } from '../../../../api/errors';

const { Text, Link, Paragraph } = Typography;

export interface LineOaWizardProps {
  open: boolean;
  /** 目前設定（修改時帶入；第一次設定時 configured=false） */
  settings: LineOaSettings;
  onClose: () => void;
  /** 儲存並檢查完成（不論是否啟用） */
  onChecked: (result: LineOaVerifyResult) => void;
}

const LIFF_ID_PATTERN = /^(\d{6,20})-[A-Za-z0-9]{4,40}$/;

/** 檢查結果清單（精靈與卡片共用） */
export function CheckList({ checks }: { checks: LineOaCheck[] }) {
  const { token } = theme.useToken();
  return (
    <List
      size="small"
      bordered
      dataSource={checks}
      renderItem={(c) => {
        const icon = c.ok ? (
          <CheckCircleFilled style={{ color: token.colorSuccess }} aria-label="通過" />
        ) : c.required ? (
          <CloseCircleFilled style={{ color: token.colorError }} aria-label="未通過" />
        ) : (
          <ExclamationCircleFilled style={{ color: token.colorWarning }} aria-label="提示" />
        );
        return (
          <List.Item>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, lineHeight: '22px' }}>{icon}</span>
              <div>
                <div style={{ fontWeight: 500 }}>
                  {c.label}
                  {!c.required && !c.ok && (
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                      不影響啟用
                    </Text>
                  )}
                </div>
                {c.detail && (
                  <Text type="secondary" style={{ fontSize: 13, wordBreak: 'break-all' }}>
                    {c.detail}
                  </Text>
                )}
              </div>
            </div>
          </List.Item>
        );
      }}
    />
  );
}

/** 要貼到 LINE Developers 的值：一鍵複製 */
function CopyValue({ value }: { value: string }) {
  const { token } = theme.useToken();
  return (
    <Text
      copyable
      code
      style={{ display: 'inline-block', marginTop: 4, padding: '2px 4px', background: token.colorFillAlter, wordBreak: 'break-all' }}
    >
      {value}
    </Text>
  );
}

/**
 * 設定健身房 LINE 官方帳號的三個步驟（docs/adr/0005-gym-line-oa.md）：
 * 1. Messaging API（Channel secret、access token）2. LINE 登入與 LIFF（Channel ID、LIFF ID）3. 儲存並檢查連線
 */
export function LineOaWizard({ open, settings, onClose, onChecked }: LineOaWizardProps) {
  const { token } = theme.useToken();
  const [step, setStep] = useState(0);
  const [secret, setSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loginChannelId, setLoginChannelId] = useState('');
  const [liffId, setLiffId] = useState('');
  const [result, setResult] = useState<LineOaVerifyResult | null>(null);

  useEffect(() => {
    if (open) {
      setStep(0);
      setSecret('');
      setAccessToken('');
      setLoginChannelId(settings.login_channel_id ?? '');
      setLiffId(settings.liff_id ?? '');
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const firstTime = !settings.configured;
  const step1Ok = !firstTime || (secret.trim() !== '' && accessToken.trim() !== '');
  const liffMatch = LIFF_ID_PATTERN.exec(liffId.trim());
  let liffProblem: string | null = null;
  if (loginChannelId.trim() && !/^\d{6,20}$/.test(loginChannelId.trim())) liffProblem = 'Channel ID 應為數字';
  else if (liffId.trim() && !liffMatch) liffProblem = 'LIFF ID 格式不正確（例如 2001234567-AbCdEfGh）';
  else if (liffMatch && loginChannelId.trim() && liffMatch[1] !== loginChannelId.trim())
    liffProblem = 'LIFF ID 開頭應該是這個 LINE 登入 channel 的 Channel ID，請確認 LIFF 建在同一個 channel';
  const step2Ok = loginChannelId.trim() !== '' && liffId.trim() !== '' && !liffProblem;

  const saveMutation = useMutation({
    mutationFn: async () => {
      await saveLineOa({
        channel_secret: secret.trim() || null,
        access_token: accessToken.trim() || null,
        login_channel_id: loginChannelId.trim(),
        liff_id: liffId.trim(),
      });
      return verifyLineOa();
    },
    onSuccess: (res) => {
      setResult(res);
      onChecked(res);
    },
  });

  const hintPlaceholder = (hint: string | null) => (hint ? `已設定 ${hint}，留空表示不變` : undefined);
  const field = (id: string, label: string, control: React.ReactNode, extra?: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={{ fontWeight: 500 }}>
        {label}
      </label>
      {control}
      {extra}
    </div>
  );
  const box: React.CSSProperties = {
    background: token.colorFillAlter,
    borderRadius: token.borderRadiusLG,
    padding: '12px 16px',
    fontSize: 14,
    lineHeight: 1.8,
  };

  const footer =
    step < 2 ? (
      <>
        {step > 0 && <Button onClick={() => setStep(step - 1)}>上一步</Button>}
        <Button type="primary" disabled={step === 0 ? !step1Ok : !step2Ok} onClick={() => setStep(step + 1)}>
          下一步
        </Button>
      </>
    ) : result ? (
      <>
        {!result.enabled && <Button onClick={() => { setResult(null); setStep(0); }}>回去修改</Button>}
        <Button type="primary" onClick={onClose}>
          完成
        </Button>
      </>
    ) : (
      <>
        <Button onClick={() => setStep(1)}>上一步</Button>
        <Button type="primary" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          儲存並檢查連線
        </Button>
      </>
    );

  return (
    <Modal open={open} title="設定 LINE 官方帳號" width={760} onCancel={onClose} footer={footer} destroyOnHidden>
      <Steps
        size="small"
        current={step}
        style={{ margin: '8px 0 24px' }}
        items={[{ title: 'Messaging API' }, { title: 'LINE 登入與 LIFF' }, { title: '檢查並啟用' }]}
      />

      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ol style={{ ...box, margin: 0, paddingLeft: 36 }}>
            <li>
              到 <Link href="https://manager.line.biz/" target="_blank">LINE Official Account Manager</Link> › 設定 › Messaging
              API，按「啟用 Messaging API」，選擇（或建立）服務提供者（Provider）。
            </li>
            <li>
              到 <Link href="https://developers.line.biz/console/" target="_blank">LINE Developers</Link>，打開這個
              Provider 底下你的官方帳號 channel：
              <br />・Basic settings 頁籤：複製 <strong>Channel secret</strong>
              <br />・Messaging API 頁籤：最下方發行並複製 <strong>Channel access token（long-lived）</strong>，同一頁打開「Use webhook」
            </li>
          </ol>
          {field(
            'oa-secret',
            'Channel secret',
            <Input.Password
              id="oa-secret"
              autoComplete="off"
              value={secret}
              placeholder={hintPlaceholder(settings.channel_secret_hint)}
              onChange={(e) => setSecret(e.target.value)}
            />,
          )}
          {field(
            'oa-token',
            'Channel access token（long-lived）',
            <Input.Password
              id="oa-token"
              autoComplete="off"
              value={accessToken}
              placeholder={hintPlaceholder(settings.access_token_hint)}
              onChange={(e) => setAccessToken(e.target.value)}
            />,
            <Text type="secondary" style={{ fontSize: 13 }}>
              金鑰加密保存，儲存後畫面只顯示末四碼。
            </Text>,
          )}
        </div>
      )}

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ol style={{ ...box, margin: 0, paddingLeft: 36 }}>
            <li>
              在<strong>同一個 Provider</strong> 建立「LINE Login」channel（App types 勾選 Web app），建立後把狀態從 Developing 改成
              Published。
              <Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
                一定要同一個 Provider：LINE 給同一個人的 ID 依 Provider 而不同，不同 Provider 就對不上官方帳號。
              </Text>
            </li>
            <li>
              LIFF 頁籤 › Add：Size 選 <strong>Full</strong>；Scopes 勾 <strong>openid</strong>、<strong>profile</strong>；Add friend
              option 選 <strong>On (Aggressive)</strong>；Endpoint URL 填：
              <br />
              <CopyValue value={settings.liff_endpoint_url} />
            </li>
            <li>複製 LINE Login channel 的 Channel ID（Basic settings）與剛建立的 LIFF ID。</li>
          </ol>
          {field(
            'oa-login-id',
            'LINE 登入 Channel ID',
            <Input
              id="oa-login-id"
              inputMode="numeric"
              value={loginChannelId}
              placeholder="例如 2001234567"
              onChange={(e) => setLoginChannelId(e.target.value)}
            />,
          )}
          {field(
            'oa-liff-id',
            'LIFF ID',
            <Input
              id="oa-liff-id"
              value={liffId}
              placeholder="例如 2001234567-AbCdEfGh"
              status={liffProblem ? 'error' : undefined}
              onChange={(e) => setLiffId(e.target.value)}
            />,
            liffProblem && (
              <Text type="danger" style={{ fontSize: 13 }}>
                {liffProblem}
              </Text>
            ),
          )}
        </div>
      )}

      {step === 2 && !result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Paragraph style={{ margin: 0 }}>按「儲存並檢查連線」後，系統會：</Paragraph>
          <ul style={{ ...box, margin: 0, paddingLeft: 36 }}>
            <li>用 access token 讀取官方帳號名稱，確認金鑰正確</li>
            <li>
              把 Webhook 設成
              <br />
              <CopyValue value={settings.webhook_url} />
            </li>
            <li>建立底部選單：預約課程・我的預約・購買方案・會員中心（會取代目前的預設選單）</li>
          </ul>
          {saveMutation.isError && <Alert type="error" showIcon title={apiErrorMessage(saveMutation.error)} />}
        </div>
      )}

      {step === 2 && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {result.enabled ? (
            <Result
              status="success"
              style={{ padding: '8px 0' }}
              title="LINE 會員入口已啟用"
              subTitle="會員打開官方帳號的底部選單，就能加入會員、預約與購買。"
            />
          ) : (
            <Alert type="error" showIcon title="尚未啟用：請依下方提示修正後再檢查一次" />
          )}
          <CheckList checks={result.checks} />
          {result.enabled && (
            <Alert
              type="info"
              showIcon
              title="建議到 LINE Official Account Manager › 回應設定，關閉「加入好友的歡迎訊息」，避免和系統的歡迎訊息重複。聊天功能可以照常使用。"
            />
          )}
        </div>
      )}
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { Button, Modal, QRCode, Result, Space, Spin, Typography, theme } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { createLineBindCode, getLineBindStatus, type LineRecipient } from '../../../../api/line';
import { apiErrorMessage } from '../../../../api/errors';

dayjs.extend(utc);

const POLL_MS = 3000;

export interface LineBindModalProps {
  open: boolean;
  /** 通知帳號在 LINE 上顯示的名稱 */
  botName: string;
  onClose: () => void;
  /** 對方完成綁定 */
  onBound: (recipient: LineRecipient | null) => void;
}

/** mm:ss 倒數 */
function useCountdown(expiresAt: string | undefined): string | null {
  const [now, setNow] = useState(() => dayjs());
  useEffect(() => {
    if (!expiresAt) return undefined;
    const timer = window.setInterval(() => setNow(dayjs()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const seconds = Math.max(0, dayjs.utc(expiresAt).diff(now, 'second'));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * 新增 LINE 通知接收人：顯示加好友 QR 碼與 6 位數綁定碼，每 3 秒查詢一次是否已綁定。
 * 綁定碼 10 分鐘內有效、只能使用一次；過期可重新產生。
 */
export function LineBindModal({ open, botName, onClose, onBound }: LineBindModalProps) {
  const { token } = theme.useToken();
  const codeMutation = useMutation({ mutationFn: createLineBindCode });
  const code = codeMutation.data;

  // 每次打開都產生新的綁定碼
  useEffect(() => {
    if (open) codeMutation.mutate();
    else codeMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: bindStatus } = useQuery({
    queryKey: ['line-bind-status', code?.id],
    queryFn: () => getLineBindStatus(code!.id),
    enabled: open && !!code,
    refetchInterval: (query) => (query.state.data?.status && query.state.data.status !== 'waiting' ? false : POLL_MS),
  });
  const countdown = useCountdown(code?.expires_at);
  const state = bindStatus?.status ?? 'waiting';

  return (
    <Modal open={open} title="新增 LINE 通知接收人" onCancel={onClose} footer={null} width={560} destroyOnHidden>
      {codeMutation.isPending && (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Spin />
        </div>
      )}
      {codeMutation.isError && (
        <Result status="error" title="無法產生綁定碼" subTitle={apiErrorMessage(codeMutation.error)} />
      )}

      {code && state === 'waiting' && (
        <Space orientation="vertical" size={20} style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {code.add_friend_url ? (
              <QRCode value={code.add_friend_url} size={160} bordered aria-label={`加入「${botName}」好友的 QR 碼`} />
            ) : null}
            <ol style={{ margin: 0, paddingLeft: 20, flex: '1 1 240px', lineHeight: 1.8 }}>
              <li>
                用要收通知的手機
                {code.add_friend_url ? (
                  <>
                    掃描 QR 碼（或
                    <Typography.Link href={code.add_friend_url} target="_blank">
                      開啟加好友連結
                    </Typography.Link>
                    ）
                  </>
                ) : (
                  '在 LINE 搜尋'
                )}
                ，加入「{botName}」為好友
              </li>
              <li>在對話裡傳送下方的綁定碼</li>
              <li>綁定成功後，這裡會自動更新</li>
            </ol>
          </div>
          <div
            style={{
              background: token.colorFillAlter,
              borderRadius: token.borderRadiusLG,
              padding: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <Typography.Text type="secondary">綁定碼</Typography.Text>
              <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '0.2em', fontVariantNumeric: 'tabular-nums' }}>
                <Typography.Text copyable={{ text: code.code }} style={{ fontSize: 'inherit' }}>
                  {`${code.code.slice(0, 3)} ${code.code.slice(3)}`}
                </Typography.Text>
              </div>
            </div>
            <Typography.Text type="secondary">{countdown} 後失效・只能使用一次</Typography.Text>
          </div>
          <Space>
            <Spin size="small" />
            <Typography.Text type="secondary">等待對方傳送綁定碼…</Typography.Text>
          </Space>
        </Space>
      )}

      {state === 'expired' && (
        <Result
          status="warning"
          title="綁定碼已過期"
          subTitle="請重新產生一組綁定碼，並在 10 分鐘內傳送。"
          extra={
            <Button type="primary" onClick={() => codeMutation.mutate()} loading={codeMutation.isPending}>
              重新產生
            </Button>
          }
        />
      )}

      {state === 'bound' && (
        <Result
          status="success"
          title={`已綁定「${bindStatus?.recipient?.display_name ?? 'LINE 使用者'}」`}
          subTitle="預設接收全部三種通知，可以在列表調整。"
          extra={
            <Button type="primary" onClick={() => onBound(bindStatus?.recipient ?? null)}>
              完成
            </Button>
          }
        />
      )}
    </Modal>
  );
}

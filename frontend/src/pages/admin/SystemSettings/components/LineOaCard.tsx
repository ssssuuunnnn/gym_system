import { useState } from 'react';
import { Alert, App, Avatar, Button, Card, Descriptions, Popconfirm, QRCode, Space, Tag, Typography, theme } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { disableLineOa, getLineOa, verifyLineOa, type LineOaCheck, type LineOaSettings } from '../../../../api/lineOa';
import { apiErrorMessage } from '../../../../api/errors';
import { formatServerTime } from '../../../../lib/datetime';
import { CheckList, LineOaWizard } from './LineOaWizard';
import { LineMemberNotifyPanel } from './LineMemberNotifyPanel';

const QUERY_KEY = ['line-oa'];
const { Text, Paragraph } = Typography;

/**
 * 系統設定 › LINE 官方帳號（docs/adr/0005-gym-line-oa.md）：健身房自己的官方帳號，
 * 會員在 LINE 裡加入會員、預約、查預約、購買。設定、檢查連線、停用都立即生效。
 */
export function LineOaCard() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [checks, setChecks] = useState<LineOaCheck[] | null>(null);
  const { data, isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: getLineOa });

  const setData = (s: LineOaSettings) => queryClient.setQueryData(QUERY_KEY, s);
  const verifyMutation = useMutation({
    mutationFn: verifyLineOa,
    onSuccess: (res) => {
      setData(res.settings);
      setChecks(res.checks);
      if (res.enabled) message.success('連線正常，已啟用');
      else message.error('檢查未通過，請依提示修正');
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });
  const disableMutation = useMutation({
    mutationFn: disableLineOa,
    onSuccess: (s) => {
      setData(s);
      message.success('已停用 LINE 會員入口');
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const extra = data?.configured ? (
    <Space>
      <Button onClick={() => setWizardOpen(true)}>修改設定</Button>
      <Button type="primary" loading={verifyMutation.isPending} onClick={() => verifyMutation.mutate()}>
        檢查連線
      </Button>
    </Space>
  ) : (
    <Button type="primary" onClick={() => setWizardOpen(true)} disabled={!data}>
      開始設定
    </Button>
  );

  return (
    <Card title="LINE 官方帳號（會員入口）" loading={isLoading} extra={extra}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Text type="secondary">
          會員在你的 LINE 官方帳號裡加入會員、預約課程、查詢預約與購買方案，不用另外下載 App 或記帳號密碼。
        </Text>

        {data && !data.configured && (
          <div
            style={{
              background: token.colorFillAlter,
              borderRadius: token.borderRadiusLG,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <Text strong>需要準備</Text>
            <Text>・已建立的 LINE 官方帳號，並能登入 LINE Developers</Text>
            <Text>・約 15 分鐘：開啟 Messaging API、建立 LINE 登入與 LIFF，把 4 個值貼回這裡</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              推播與回覆訊息算在你自己的官方帳號方案；目前只在會員加好友與傳關鍵字時回覆（回覆不計費）。
            </Text>
          </div>
        )}

        {data?.configured && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Avatar size={48} src={data.bot_picture_url ?? undefined} alt="">
                {(data.bot_name ?? 'L').charAt(0)}
              </Avatar>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{data.bot_name ?? '尚未讀取官方帳號'}</div>
                <Text type="secondary">{data.bot_basic_id ?? '按「檢查連線」讀取'}</Text>
              </div>
              <Tag color={data.enabled ? 'green' : 'default'}>{data.enabled ? '已啟用' : '未啟用'}</Tag>
            </div>

            {!data.enabled && !data.last_error && (
              <Alert type="info" showIcon title="設定已儲存，按「檢查連線」通過後才會啟用。" />
            )}
            {data.last_error && (
              <Alert type={data.enabled ? 'warning' : 'error'} showIcon title="上次檢查的問題" description={data.last_error} />
            )}
            {checks && <CheckList checks={checks} />}

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Descriptions
                column={1}
                size="small"
                style={{ flex: '1 1 420px' }}
                styles={{ label: { width: 120 } }}
                items={[
                  {
                    key: 'liff',
                    label: '會員入口',
                    children: data.liff_url ? (
                      <Text copyable style={{ wordBreak: 'break-all' }}>
                        {data.liff_url}
                      </Text>
                    ) : (
                      '啟用後顯示'
                    ),
                  },
                  { key: 'members', label: '已綁定會員', children: `${data.linked_members} 人` },
                  { key: 'menu', label: '底部選單', children: data.rich_menu_set ? '已設定（預約課程・我的預約・購買方案・會員中心）' : '未設定' },
                  {
                    key: 'keys',
                    label: '金鑰',
                    children: `Channel secret ${data.channel_secret_hint ?? '—'}・Access token ${data.access_token_hint ?? '—'}`,
                  },
                  { key: 'login', label: 'LINE 登入', children: `Channel ID ${data.login_channel_id}・LIFF ${data.liff_id}` },
                  {
                    key: 'checked',
                    label: '最後檢查',
                    children: data.verified_at ? formatServerTime(data.verified_at) : '尚未通過',
                  },
                ]}
              />
              {data.add_friend_url && (
                <div style={{ textAlign: 'center' }}>
                  <QRCode value={data.add_friend_url} size={128} aria-label="加入官方帳號好友的 QR 碼" />
                  <Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    加好友 QR 碼，可印出放在櫃台
                  </Paragraph>
                </div>
              )}
            </div>

            <LineMemberNotifyPanel settings={data} />

            {data.enabled && (
              <div>
                <Popconfirm
                  title="停用 LINE 會員入口？"
                  description="會員暫時無法在 LINE 裡登入；已綁定的會員會保留，重新檢查連線後恢復。"
                  okText="停用"
                  okButtonProps={{ danger: true }}
                  cancelText="取消"
                  onConfirm={() => disableMutation.mutateAsync()}
                >
                  <Button danger type="text">
                    停用
                  </Button>
                </Popconfirm>
              </div>
            )}
          </>
        )}
      </div>

      {data && (
        <LineOaWizard
          open={wizardOpen}
          settings={data}
          onClose={() => setWizardOpen(false)}
          onChecked={(res) => {
            setData(res.settings);
            setChecks(res.checks);
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
          }}
        />
      )}
    </Card>
  );
}

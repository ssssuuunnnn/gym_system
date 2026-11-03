import { App, Button, Card, Flex, Grid, Popconfirm, Progress, Tag, Tooltip, Typography, theme } from 'antd';
import { CheckCircleFilled, GiftOutlined, RightOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { dismissOnboarding, getOnboarding, type OnboardingStepKey } from '../../../../api/onboarding';
import type { PermissionCode } from '../../../../api/staff';
import { apiErrorMessage } from '../../../../api/errors';
import { usePermissions } from '../../../../lib/permissions';
import { useTerms, type Terms } from '../../../../lib/terms';
import { formatServerTime } from '../../../../lib/datetime';

interface StepCopy {
  title: string;
  description: string;
  path: string;
  /** 前往的頁面需要的權限；沒有時按鈕停用並提示 */
  perm: PermissionCode;
  action: string;
  extra?: ReactNode;
}

const registerUrl = () => `${window.location.origin}/register`;

/** 每一步的文字與前往的頁面（依行業用詞）。完成與否由後端從實際資料判斷（services/onboarding.py）。 */
function stepCopy(key: OnboardingStepKey, t: Terms): StepCopy {
  switch (key) {
    case 'profile':
      return {
        title: '確認店名、上傳 LOGO',
        description: '會顯示在後台、會員頁面與形象網站',
        path: '/admin/settings',
        perm: 'settings',
        action: '前往系統設定',
      };
    case 'payment':
      return {
        title: '寫下付款方式',
        description: '會員線上下單後會看到這段說明，例如轉帳帳號、到店付款',
        path: '/admin/settings',
        perm: 'settings',
        action: '前往系統設定',
      };
    case 'staff':
      return {
        title: `新增${t.staff}`,
        description: `會員預約時可以挑選${t.staff}，之後也用來計算${t.staffPay}`,
        path: '/admin/coaches/new',
        perm: 'coaches',
        action: `新增${t.staff}`,
      };
    case 'plans':
      return {
        title: '建立方案',
        description: `例如單次${t.trial}、10 ${t.unit}方案；會員買了方案才能預約`,
        path: '/admin/products/new',
        perm: 'products',
        action: '建立方案',
      };
    case 'website':
      return {
        title: '發布形象網站',
        description: `讓客人在網路上找到你，也能直接預約${t.trial}`,
        path: '/admin/website',
        perm: 'website',
        action: '編輯形象網站',
      };
    case 'members':
      return {
        title: '迎接第一位會員',
        description: '把註冊網址傳給客人，或在會員管理直接新增',
        path: '/admin/members',
        perm: 'members',
        action: '前往會員管理',
        extra: (
          <Typography.Text
            copyable={{
              text: registerUrl(),
              tooltips: ['複製註冊網址', '已複製'],
            }}
            type="secondary"
            style={{ fontSize: 13 }}
          >
            {registerUrl()}
          </Typography.Text>
        ),
      };
    case 'line':
      return {
        title: '串接 LINE 官方帳號',
        description: '會員可以在 LINE 裡加入、預約，並收到預約提醒',
        path: '/admin/settings',
        perm: 'settings',
        action: '前往設定',
      };
  }
}

/**
 * 開店設定清單（ADR 0016）：儀表板最上方，依實際資料自動打勾，讓新店家不用人帶也知道下一步做什麼。
 * 全部完成或按「隱藏清單」後收起（整間店共用；系統設定可以重新顯示）。只給有系統設定權限的帳號看。
 */
export function SetupChecklist() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { t } = useTerms();
  const { can } = usePermissions();
  const navigate = useNavigate();
  // 手機寬度：按鈕放到說明下面，文字不會被擠成一直條
  const narrow = !Grid.useBreakpoint().sm;
  const { data } = useQuery({
    queryKey: ['onboarding'],
    queryFn: getOnboarding,
  });

  const dismissMutation = useMutation({
    mutationFn: dismissOnboarding,
    onSuccess: (next) => {
      queryClient.setQueryData(['onboarding'], next);
      message.success('已隱藏，之後可以在系統設定重新顯示');
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  // 剛送出試用天數：恭喜一下，並更新頁首的「試用剩 N 天」
  const justGranted = data?.bonus?.just_granted_days ?? 0;
  const allGranted = data?.bonus?.status === 'granted';
  useEffect(() => {
    if (!justGranted) return;
    message.success(
      allGranted ? `開店設定完成！這次多送你 ${justGranted} 天試用` : `完成一項設定，多送你 ${justGranted} 天試用`,
    );
    queryClient.invalidateQueries({ queryKey: ['tenant-profile'] });
  }, [justGranted, allGranted, message, queryClient]);

  if (!data || data.dismissed) return null;

  const percent = Math.round((data.done_count / data.required_count) * 100);
  const nextKey = data.steps.find((s) => !s.done && !s.optional)?.key ?? data.steps.find((s) => !s.done)?.key;

  const hideButton = (
    <Popconfirm
      title="隱藏開店設定清單？"
      description="之後可以在「系統設定」重新顯示"
      okText="隱藏"
      cancelText="取消"
      onConfirm={() => dismissMutation.mutateAsync()}
    >
      <Button type="text" size="small" loading={dismissMutation.isPending}>
        隱藏清單
      </Button>
    </Popconfirm>
  );

  return (
    <Card
      style={{ marginBottom: 16 }}
      title={
        <Flex align="center" gap={12} wrap>
          <span>開店設定</span>
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            完成 {data.done_count} / {data.required_count} 項
          </Typography.Text>
        </Flex>
      }
      extra={hideButton}
    >
      <Progress percent={percent} showInfo={false} strokeColor={token.colorSuccess} style={{ marginBottom: 12 }} />
      {data.bonus?.status === 'available' && (
        <Typography.Paragraph style={{ marginBottom: 12 }}>
          <GiftOutlined style={{ color: token.colorPrimary, marginInlineEnd: 8 }} />
          {`每完成一項必做設定多送 ${data.bonus.days_per_step} 天試用，全部完成再加送 ${data.bonus.completion_days} 天（已經拿到 `}
          <Typography.Text strong>{data.bonus.earned_days}</Typography.Text> / {data.bonus.total_days} 天）
        </Typography.Paragraph>
      )}
      {data.bonus?.status === 'granted' && (
        <Typography.Paragraph style={{ marginBottom: 12 }}>
          <GiftOutlined style={{ color: token.colorSuccess, marginInlineEnd: 8 }} />
          已多送你 {data.bonus.earned_days} 天試用
          {data.bonus.trial_ends_at && `，試用到 ${formatServerTime(data.bonus.trial_ends_at, 'YYYY-MM-DD')}`}
        </Typography.Paragraph>
      )}
      {data.completed && (
        <Typography.Paragraph style={{ marginBottom: 12 }}>
          <CheckCircleFilled style={{ color: token.colorSuccess, marginInlineEnd: 8 }} />
          基本設定都完成了，可以開始接受預約！清單用不到了的話，按右上角「隱藏清單」。
        </Typography.Paragraph>
      )}
      <Flex vertical>
        {data.steps.map((step, index) => {
          const copy = stepCopy(step.key, t);
          const allowed = can(copy.perm);
          const isNext = step.key === nextKey;
          const actionButton = (
            <Tooltip title={allowed ? undefined : '你的帳號沒有這個功能的權限，請主要管理者處理'}>
              {allowed ? (
                <Button
                  type={isNext ? 'primary' : 'default'}
                  size="small"
                  icon={<RightOutlined />}
                  iconPosition="end"
                  onClick={() => navigate(copy.path)}
                >
                  {copy.action}
                </Button>
              ) : (
                <Button size="small" disabled>
                  {copy.action}
                </Button>
              )}
            </Tooltip>
          );
          return (
            <Flex
              key={step.key}
              gap={12}
              align="flex-start"
              style={{
                padding: '12px 0',
                borderTop: index === 0 ? undefined : `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  flex: 'none',
                  width: 24,
                  height: 24,
                  marginTop: 2,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: isNext ? token.colorWhite : token.colorTextSecondary,
                  background: isNext ? token.colorPrimary : token.colorFillTertiary,
                }}
              >
                {step.done ? <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 24 }} /> : index + 1}
              </span>
              <Flex vertical gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Flex gap={8} align="center" wrap>
                  <Typography.Text strong={!step.done} type={step.done ? 'secondary' : undefined} delete={step.done}>
                    {copy.title}
                  </Typography.Text>
                  {step.optional && <Tag>選做</Tag>}
                  {step.done && <Tag color="success">已完成</Tag>}
                  {data.bonus?.status === 'available' &&
                    !step.optional &&
                    (data.bonus.granted_steps.includes(step.key) ? (
                      <Tag color="success">已送 {data.bonus.days_per_step} 天</Tag>
                    ) : (
                      <Tag color="processing" icon={<GiftOutlined />}>
                        +{data.bonus.days_per_step} 天
                      </Tag>
                    ))}
                </Flex>
                {!step.done && (
                  <>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {copy.description}
                    </Typography.Text>
                    {copy.extra}
                    {narrow && <div style={{ marginTop: 6 }}>{actionButton}</div>}
                  </>
                )}
              </Flex>
              {!step.done && !narrow && actionButton}
            </Flex>
          );
        })}
      </Flex>
    </Card>
  );
}

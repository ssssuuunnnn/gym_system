import { App, Card, Switch, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '../../../../api/settings';
import { apiErrorMessage } from '../../../../api/errors';
import { useTerms } from '../../../../lib/terms';

/**
 * 功能開關（ADR 0011）：團體課程。美體店預設關閉，健身房預設開啟。
 * 和 LINE 卡片一樣立即生效，不經過頁面底部的儲存列。
 */
export function FeaturesCard() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { businessType } = useTerms();
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSettings });
  const enabled = settings?.group_classes_enabled ?? true;

  const mutation = useMutation({
    mutationFn: (on: boolean) => updateSettings({ group_classes_enabled: on }),
    onSuccess: (_s, on) => {
      message.success(on ? '已開啟團體課程' : '已關閉團體課程');
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-profile'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  return (
    <Card title="功能">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, maxWidth: 840 }}>
        <Switch
          id="feature-group-classes"
          checked={enabled}
          loading={mutation.isPending}
          disabled={!settings}
          onChange={(on) => mutation.mutate(on)}
        />
        <label htmlFor="feature-group-classes" style={{ display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}>
          <Typography.Text strong>團體課程</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            多人一起上的固定課程與課表。關閉後會隱藏後台「課程管理」、會員預約頁的團體課分頁、團體課程方案與網站課表；
            已建立的資料都會保留。{businessType === '美體' ? '美體店預設關閉。' : '健身房預設開啟。'}
          </Typography.Text>
        </label>
      </div>
    </Card>
  );
}

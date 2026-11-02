import { Alert, App, Button, Popconfirm } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearSampleData, getSettings } from '../../api/settings';
import { apiErrorMessage } from '../../api/errors';
import { useTerms } from '../../lib/terms';

/**
 * 開通時自動建立的範例資料（ADR 0013、R56）：還在的話提示，可一鍵清除。
 * 需要「系統設定」權限才顯示（呼叫端判斷）。
 */
export function SampleDataAlert() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { t } = useTerms();
  const { data: settings } = useQuery({ queryKey: ['system-settings'], queryFn: getSettings });

  const mutation = useMutation({
    mutationFn: clearSampleData,
    onSuccess: (r) => {
      message.success(r.kept ? `已清除 ${r.removed} 筆；${r.kept} 筆已經有人使用，改為下架或封存` : `已清除 ${r.removed} 筆範例資料`);
      queryClient.invalidateQueries();
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  if (!settings?.has_sample_data) return null;
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
      title="目前有開通時建立的範例資料"
      description={`範例的${t.staff}、方案與形象網站草稿是讓你先看看效果用的；準備好自己的資料後可以一鍵清除。已經有人購買或預約的會改為下架或封存，不會刪掉紀錄。`}
      action={
        <Popconfirm
          title="清除範例資料？"
          description={`範例的${t.staff}、方案與課程會被刪除，無法復原`}
          okText="清除"
          okButtonProps={{ danger: true }}
          cancelText="取消"
          onConfirm={() => mutation.mutateAsync()}
        >
          <Button size="small" loading={mutation.isPending}>
            清除範例資料
          </Button>
        </Popconfirm>
      }
    />
  );
}

import { Alert, App, Button } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getOnboarding, restoreOnboarding } from '../../../../api/onboarding';
import { apiErrorMessage } from '../../../../api/errors';

/** 儀表板的開店設定清單被隱藏時，在這裡可以重新顯示（ADR 0016）。沒隱藏就不顯示。 */
export function OnboardingRestore() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['onboarding'], queryFn: getOnboarding });
  const mutation = useMutation({
    mutationFn: restoreOnboarding,
    onSuccess: (next) => {
      queryClient.setQueryData(['onboarding'], next);
      message.success('已重新顯示，回到儀表板就看得到');
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });
  if (!data?.dismissed) return null;
  return (
    <Alert
      type="info"
      showIcon
      title={`儀表板的「開店設定」清單已隱藏（完成 ${data.done_count} / ${data.required_count} 項）`}
      action={
        <Button size="small" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          重新顯示
        </Button>
      }
    />
  );
}

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { markNotificationRead, QUERY_KEYS_BY_KIND, type StaffNotification } from '../../api/notifications';

/** 打開一則通知：標成已讀、讓對應頁面重新讀資料、換到通知指向的頁面 */
export function useOpenNotification() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useCallback(
    (n: StaffNotification) => {
      for (const key of QUERY_KEYS_BY_KIND[n.kind]) queryClient.invalidateQueries({ queryKey: [key] });
      navigate(n.link);
      if (n.read_at) return;
      markNotificationRead(n.id)
        .catch(() => undefined)
        .finally(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }));
    },
    [navigate, queryClient],
  );
}

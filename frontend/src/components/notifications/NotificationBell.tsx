import { useEffect, useRef, useState } from 'react';
import { App, Badge, Button, Popover } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotificationSummary, QUERY_KEYS_BY_KIND, type StaffNotification } from '../../api/notifications';
import { getMe } from '../../api/users';
import { NotificationKindIcon } from './NotificationKindIcon';
import { NotificationPanel } from './NotificationPanel';
import { useOpenNotification } from './useOpenNotification';

/** 多久問一次有沒有新通知 */
const POLL_MS = 20_000;
/** toast 停留秒數 */
const TOAST_SECONDS = 6;
/** 一次最多跳幾則 toast，其餘合成一則「還有 N 則新通知」 */
const TOAST_MAX = 3;

/**
 * 後台右上角的鈴鐺（ADR 0009）：未讀數、點開看通知列表；有新通知時在右上角跳 toast（6 秒、無聲音）。
 * 剛打開後台時不跳舊通知；同時開好幾個分頁時只有一個分頁會跳（瀏覽器儲存記住已跳過的最新 id）。
 */
export function NotificationBell() {
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const openNotification = useOpenNotification();
  const [open, setOpen] = useState(false);
  // 已經看過（跳過 toast 或剛打開時就存在）的最新通知 id
  const seenId = useRef<number | null>(null);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe, staleTime: 30_000 });
  const { data: summary } = useQuery({
    queryKey: ['notifications', 'summary'],
    queryFn: () => getNotificationSummary(seenId.current ?? undefined),
    refetchInterval: POLL_MS,
  });
  const unread = summary?.unread_count ?? 0;

  useEffect(() => {
    if (!summary || !me) return;
    if (seenId.current === null) {
      seenId.current = summary.latest_id;
      return;
    }
    seenId.current = Math.max(seenId.current, summary.latest_id);
    if (!summary.new.length) return;

    // 有新通知：讓對應頁面與鈴鐺列表重新讀資料
    const kinds = new Set(summary.new.map((n) => n.kind));
    for (const kind of kinds) for (const key of QUERY_KEYS_BY_KIND[kind]) queryClient.invalidateQueries({ queryKey: [key] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });

    // 多個分頁只跳一次
    const storageKey = `staffNotifToasted:${window.location.hostname}:${me.id}`;
    let toasted = 0;
    try {
      toasted = Number(localStorage.getItem(storageKey)) || 0;
    } catch {
      // 讀不到就每個分頁都跳
    }
    const fresh = summary.new.filter((n) => n.id > toasted).reverse(); // 舊到新
    if (!fresh.length) return;
    try {
      localStorage.setItem(storageKey, String(fresh[fresh.length - 1].id));
    } catch {
      // 無痕視窗：只在這個分頁跳
    }
    const show = (n: StaffNotification) => {
      const key = `staff-notification-${n.id}`;
      notification.open({
        key,
        title: n.title,
        description: n.body,
        icon: <NotificationKindIcon kind={n.kind} size={24} />,
        placement: 'topRight',
        duration: TOAST_SECONDS,
        style: { cursor: 'pointer' },
        onClick: () => {
          notification.destroy(key);
          openNotification(n);
        },
      });
    };
    fresh.slice(-TOAST_MAX).forEach(show);
    if (fresh.length > TOAST_MAX) {
      notification.open({
        key: 'staff-notification-more',
        title: `還有 ${fresh.length - TOAST_MAX} 則新通知`,
        description: '點右上角的鈴鐺查看',
        placement: 'topRight',
        duration: TOAST_SECONDS,
      });
    }
  }, [summary, me, notification, queryClient, openNotification]);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      destroyOnHidden
      content={
        <NotificationPanel
          unreadCount={unread}
          onOpen={(n) => {
            setOpen(false);
            openNotification(n);
          }}
        />
      }
    >
      <Button type="text" aria-label={unread ? `通知，${unread} 則未讀` : '通知'} style={{ paddingInline: 8 }}>
        <Badge count={unread} overflowCount={99} size="small">
          <BellOutlined style={{ fontSize: 18 }} />
        </Badge>
      </Button>
    </Popover>
  );
}

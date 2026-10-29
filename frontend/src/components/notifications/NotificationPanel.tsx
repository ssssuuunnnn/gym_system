import { useState } from 'react';
import { App, Button, Empty, Flex, Segmented, Spin, Typography, theme } from 'antd';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listNotifications, markAllNotificationsRead, type StaffNotification } from '../../api/notifications';
import { apiErrorMessage } from '../../api/errors';
import { relativeServerTime } from '../../lib/datetime';
import { NotificationKindIcon } from './NotificationKindIcon';

const PAGE_SIZE = 20;
type Filter = '全部' | '未讀';

export interface NotificationPanelProps {
  unreadCount: number;
  /** 點了某一則通知（由外層標已讀、換頁、關閉面板） */
  onOpen: (n: StaffNotification) => void;
}

/** 鈴鐺下拉面板：全部／未讀切換、全部已讀、通知列表（往下載入更早的） */
export function NotificationPanel({ unreadCount, onOpen }: NotificationPanelProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('全部');

  const query = useInfiniteQuery({
    queryKey: ['notifications', 'list', filter],
    queryFn: ({ pageParam }) =>
      listNotifications({ unreadOnly: filter === '未讀', beforeId: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.has_more ? last.items[last.items.length - 1]?.id : undefined),
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  return (
    <div style={{ width: 380, maxWidth: 'calc(100vw - 32px)' }}>
      <Flex justify="space-between" align="center" style={{ padding: '4px 4px 12px' }}>
        <Typography.Text strong style={{ fontSize: 16 }}>
          通知
        </Typography.Text>
        <Button type="link" size="small" disabled={!unreadCount} loading={readAll.isPending} onClick={() => readAll.mutate()}>
          全部標為已讀
        </Button>
      </Flex>
      <Segmented<Filter>
        block
        value={filter}
        onChange={setFilter}
        options={['全部', { value: '未讀', label: unreadCount ? `未讀 ${unreadCount}` : '未讀' }]}
        style={{ marginBottom: 8 }}
      />
      <div style={{ maxHeight: 440, overflowY: 'auto', margin: '0 -12px' }}>
        {query.isLoading ? (
          <Flex justify="center" style={{ padding: 32 }}>
            <Spin />
          </Flex>
        ) : items.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={filter === '未讀' ? '沒有未讀的通知' : '還沒有通知'}
            style={{ padding: '24px 0' }}
          />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((n) => {
              const unread = !n.read_at;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(n)}
                    style={{
                      display: 'flex',
                      gap: 12,
                      width: '100%',
                      padding: '12px 12px',
                      border: 'none',
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      background: unread ? token.colorPrimaryBg : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      font: 'inherit',
                      color: token.colorText,
                    }}
                    aria-label={`${unread ? '未讀：' : ''}${n.title}，${n.body}`}
                  >
                    <NotificationKindIcon kind={n.kind} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: unread ? 600 : 400 }}>{n.title}</span>
                        <span style={{ flex: 'none', fontSize: 12, color: token.colorTextTertiary }}>
                          {relativeServerTime(n.created_at)}
                        </span>
                      </span>
                      <span style={{ display: 'block', fontSize: 13, color: token.colorTextSecondary, marginTop: 2 }}>
                        {n.body}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        flex: 'none',
                        marginTop: 6,
                        borderRadius: '50%',
                        background: unread ? token.colorPrimary : 'transparent',
                      }}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {query.hasNextPage && (
          <Flex justify="center" style={{ padding: 8 }}>
            <Button type="link" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
              載入更早的通知
            </Button>
          </Flex>
        )}
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, padding: '8px 4px 0' }}>
        通知保留 90 天
      </Typography.Text>
    </div>
  );
}

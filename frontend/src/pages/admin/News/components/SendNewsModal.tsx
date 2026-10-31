import { useMemo, useState } from 'react';
import { Alert, App, Checkbox, Descriptions, Empty, Flex, Modal, Popconfirm, Button, Statistic, Table, Typography } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  listBroadcasts,
  previewBroadcast,
  sendBroadcast,
  type BroadcastTarget,
  type NewsBroadcast,
  type NewsPost,
} from '../../../../api/news';
import type { SegmentFilters } from '../../../../api/memberSegments';
import { getLineOaQuota } from '../../../../api/lineOa';
import { listCoaches } from '../../../../api/coaches';
import { apiErrorMessage } from '../../../../api/errors';
import { MemberTagSelect } from '../../../../components/MemberTagSelect';
import { SegmentFilterCard } from '../../../../components/SegmentFilterCard';
import { defaultFilters } from '../../../../lib/memberSegments';
import { formatServerTime } from '../../../../lib/datetime';
import { useBranches } from '../../../../lib/useBranches';

export interface SendNewsModalProps {
  post: NewsPost | null;
  onClose: () => void;
}

/**
 * 用 LINE 發送最新消息（ADR 0012、R51）：對象＝有勾選標籤的會員 ∪ 會員名單條件。
 * 只會發給已綁定 LINE 且同意優惠訊息的會員；已經收過這則的不會再收到。
 */
export function SendNewsModal({ post, onClose }: SendNewsModalProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [useSegment, setUseSegment] = useState(false);
  const [draftFilters, setDraftFilters] = useState<SegmentFilters>(defaultFilters);
  // 按「試算人數」才套用名單條件（同會員名單頁）
  const [appliedFilters, setAppliedFilters] = useState<SegmentFilters>(defaultFilters);

  const open = post !== null;
  const target: BroadcastTarget = useMemo(
    () => ({ tag_ids: tagIds, filters: useSegment ? appliedFilters : null }),
    [tagIds, useSegment, appliedFilters],
  );
  const hasTarget = tagIds.length > 0 || useSegment;

  const { data: coaches = [] } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches, enabled: open && useSegment });
  const branchList = useBranches();
  const { data: preview, isFetching } = useQuery({
    queryKey: ['news-broadcast-preview', post?.id, target],
    queryFn: () => previewBroadcast(post!.id, target),
    enabled: open && hasTarget,
  });
  const { data: quota } = useQuery({ queryKey: ['line-oa-quota'], queryFn: getLineOaQuota, enabled: open });
  const { data: history } = useQuery({
    queryKey: ['news-broadcasts', post?.id],
    queryFn: () => listBroadcasts(post!.id),
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: () => sendBroadcast(post!.id, target),
    onSuccess: (r) => {
      message.success(`已開始發送給 ${r.queued} 位會員`);
      queryClient.invalidateQueries({ queryKey: ['news'] });
      queryClient.invalidateQueries({ queryKey: ['news-broadcasts', post?.id] });
      queryClient.invalidateQueries({ queryKey: ['news-broadcast-preview', post?.id] });
      queryClient.invalidateQueries({ queryKey: ['line-oa-quota'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const reset = () => {
    setTagIds([]);
    setUseSegment(false);
    setDraftFilters(defaultFilters());
    setAppliedFilters(defaultFilters());
  };

  const remaining = quota?.limited && quota.limit != null && quota.used != null ? quota.limit - quota.used : null;
  const toSend = preview?.to_send ?? 0;
  const problems = hasTarget ? (preview?.problems ?? []) : [];
  const canSend = hasTarget && !!preview && problems.length === 0 && toSend > 0 && !isFetching;

  const historyColumns: ColumnsType<NewsBroadcast> = [
    { title: '時間', dataIndex: 'created_at', width: 150, render: (v: string) => formatServerTime(v) },
    { title: '對象', dataIndex: 'target_label' },
    { title: '發送', dataIndex: 'queued_count', width: 80, align: 'right', render: (n: number) => `${n} 人` },
    { title: '操作人', dataIndex: 'created_by_name', width: 100 },
  ];

  return (
    <Modal
      open={open}
      title={post ? `用 LINE 發送「${post.title}」` : ''}
      width={960}
      onCancel={onClose}
      afterOpenChange={(visible) => !visible && reset()}
      destroyOnHidden
      footer={
        <Flex justify="space-between" align="center" gap={12} wrap>
          <Typography.Text type="secondary">每位收件人算店家 LINE 方案的 1 則訊息</Typography.Text>
          <Flex gap={8}>
            <Button onClick={onClose}>關閉</Button>
            <Popconfirm
              title={`發送給 ${toSend} 位會員？`}
              description="送出後無法收回"
              okText="發送"
              cancelText="取消"
              disabled={!canSend}
              onConfirm={() => sendMutation.mutate()}
            >
              <Button type="primary" icon={<SendOutlined />} disabled={!canSend} loading={sendMutation.isPending}>
                發送給 {toSend} 位會員
              </Button>
            </Popconfirm>
          </Flex>
        </Flex>
      }
    >
      <Flex vertical gap={16}>
        <Flex vertical gap={4}>
          <label htmlFor="news-send-tags">會員標籤（有其中任一個就會收到）</label>
          <MemberTagSelect id="news-send-tags" value={tagIds} onChange={setTagIds} showCount placeholder="選擇標籤" />
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            標籤在 <Link to="/admin/member-tags">會員標籤</Link> 管理，會員身上的標籤在會員詳情設定。
          </Typography.Text>
        </Flex>

        <Checkbox checked={useSegment} onChange={(e) => setUseSegment(e.target.checked)}>
          也發給符合會員名單條件的會員（依上課紀錄篩選，和標籤取聯集）
        </Checkbox>
        {useSegment && (
          <SegmentFilterCard
            title="會員名單條件"
            searchLabel="試算人數"
            value={draftFilters}
            onChange={setDraftFilters}
            onSearch={setAppliedFilters}
            coachOptions={coaches.map((c) => ({ value: c.id, label: c.name }))}
            branchOptions={branchList.branches.map((b) => ({ value: b.id, label: b.name }))}
            loading={isFetching}
          />
        )}

        {hasTarget ? (
          <Flex vertical gap={12}>
            <Flex gap={32} wrap>
              <Statistic title="找到會員" value={preview?.total ?? 0} suffix="人" loading={isFetching && !preview} />
              <Statistic title="這次會發送" value={toSend} suffix="人" />
              <Statistic title="未同意優惠訊息" value={preview?.no_consent ?? 0} suffix="人" />
              <Statistic title="未綁定 LINE" value={preview?.no_line ?? 0} suffix="人" />
              <Statistic title="已收過這則" value={preview?.already_sent ?? 0} suffix="人" />
            </Flex>
            <Typography.Text type="secondary">
              最新消息算優惠與活動訊息，只發給已綁定 LINE、而且在「我的」開啟「優惠與活動訊息」的會員；已經收過這則的不會再收到。
              {remaining != null && `本月 LINE 額度還剩 ${remaining} 則。`}
              {quota?.limited === false && '你的 LINE 方案沒有則數上限。'}
            </Typography.Text>
            {remaining != null && remaining < toSend && (
              <Alert type="warning" showIcon title={`本月額度只剩 ${remaining} 則，超過的會發送失敗`} />
            )}
            {problems.map((p) => (
              <Alert key={p} type="warning" showIcon title={p} />
            ))}
          </Flex>
        ) : (
          <Alert type="info" showIcon title="請選擇標籤，或勾選「也發給符合會員名單條件的會員」" />
        )}

        <div>
          <Typography.Title level={5}>發送紀錄</Typography.Title>
          {history && history.items.length > 0 && (
            <Descriptions
              size="small"
              column={4}
              style={{ marginBottom: 12 }}
              items={[
                { key: 'sent', label: '成功', children: `${history.delivery.sent} 則` },
                { key: 'pending', label: '傳送中', children: `${history.delivery.pending} 則` },
                { key: 'failed', label: '失敗', children: `${history.delivery.failed} 則` },
                { key: 'skipped', label: '略過', children: `${history.delivery.skipped} 則` },
              ]}
            />
          )}
          <Table
            rowKey="id"
            size="small"
            columns={historyColumns}
            dataSource={history?.items ?? []}
            pagination={false}
            scroll={{ x: 640 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="這則還沒用 LINE 發送過" /> }}
          />
        </div>
      </Flex>
    </Modal>
  );
}

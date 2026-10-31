import { useMemo, useState } from 'react';
import { App, Alert, Button, Card, Empty, Flex, Modal, Segmented, Select, Statistic, Table, Tag, Tooltip, Typography } from 'antd';
import { DownloadOutlined, TagsOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listCoaches } from '../../../api/coaches';
import { apiErrorMessage } from '../../../api/errors';
import { getLineOaPublic, getLineOaQuota } from '../../../api/lineOa';
import {
  createAudience,
  listAudiences,
  previewSegment,
  type LineAudience,
  type LineReach,
  type SegmentFilters,
  type SegmentMember,
} from '../../../api/memberSegments';
import { formatServerTime } from '../../../lib/datetime';
import { CreateAudienceModal } from './components/CreateAudienceModal';
import { SegmentFilterCard } from '../../../components/SegmentFilterCard';
import { defaultFilters, describeFilters, downloadCsv } from '../../../lib/memberSegments';
import { useBranches } from '../../../lib/useBranches';
import { useMemberTags } from '../../../lib/useMemberTags';
import { addMembersToTag } from '../../../api/memberTags';
import { MemberTagList } from '../../../components/MemberTagList';

const REACH_COLOR: Record<LineReach, string> = { 可發送: 'success', '未綁定 LINE': 'default', 未同意優惠訊息: 'warning' };
type ReachFilter = LineReach | '全部';

/**
 * 會員名單（ADR 0006）：依上課紀錄篩會員 → 匯出或上傳成 LINE 受眾 → 到 LINE 官方帳號後台發優惠訊息。
 * 只有綁定 LINE 且同意接收優惠訊息的會員會被上傳（R31、R33）。
 */
export default function MemberSegments() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SegmentFilters>(defaultFilters);
  // 實際查詢用的條件（按「查詢」才更新），受眾也照這組條件建立
  const [applied, setApplied] = useState<SegmentFilters>(defaultFilters);
  const [reach, setReach] = useState<ReachFilter>('全部');
  const [modalOpen, setModalOpen] = useState(false);
  // 把目前名單（含上方 LINE 篩選）加上某個標籤
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagToAdd, setTagToAdd] = useState<number | null>(null);
  const memberTags = useMemberTags();

  const { data: coaches = [] } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const coachName = useMemo(() => {
    const map = new Map(coaches.map((c) => [c.id, c.name]));
    return (id: number) => map.get(id);
  }, [coaches]);
  const branchList = useBranches();
  const { data: lineOa } = useQuery({ queryKey: ['line-oa-public'], queryFn: getLineOaPublic });
  const lineEnabled = lineOa?.enabled === true;
  const { data: quota } = useQuery({ queryKey: ['line-oa-quota'], queryFn: getLineOaQuota, enabled: lineEnabled && modalOpen });
  const { data: result, isFetching } = useQuery({
    queryKey: ['member-segments', applied],
    queryFn: () => previewSegment(applied),
  });
  const { data: audiences = [] } = useQuery({ queryKey: ['line-audiences'], queryFn: listAudiences });

  const createMutation = useMutation({
    mutationFn: (name: string) => createAudience({ name, filters: applied }),
    onSuccess: (a) => {
      message.success(`已建立受眾「${a.name}」（${a.member_count} 人）`);
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['line-audiences'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const members = result?.members ?? [];
  const rows = reach === '全部' ? members : members.filter((m) => m.reach === reach);
  const summary = describeFilters(applied, coachName, branchList.nameOf, (id) => memberTags.byId.get(id)?.name);

  const tagMutation = useMutation({
    mutationFn: (tagId: number) => addMembersToTag(tagId, rows.map((m) => m.id)),
    onSuccess: (tag) => {
      message.success(`已把 ${rows.length} 位會員加上「${tag.name}」（原本就有的略過）`);
      setTagModalOpen(false);
      setTagToAdd(null);
      queryClient.invalidateQueries({ queryKey: ['member-tags'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member-segments'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const columns: ColumnsType<SegmentMember> = [
    {
      title: '會員',
      key: 'name',
      render: (_, m) => (
        <Flex vertical>
          <Link to={`/admin/members/${m.id}`}>{m.name}</Link>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {m.username}
          </Typography.Text>
        </Flex>
      ),
    },
    { title: '手機', dataIndex: 'phone', render: (v: string | null) => v ?? '—' },
    { title: '期間出席', dataIndex: 'attended_count', align: 'right', render: (v: number) => `${v} 次`, sorter: (a, b) => a.attended_count - b.attended_count },
    { title: '最後上課', dataIndex: 'last_attended', sorter: (a, b) => a.last_attended.localeCompare(b.last_attended) },
    { title: '剩餘堂數', dataIndex: 'remaining_hours', align: 'right', render: (v: number) => `${v} 堂`, sorter: (a, b) => a.remaining_hours - b.remaining_hours },
    { title: '標籤', dataIndex: 'tag_ids', render: (ids: number[]) => <MemberTagList ids={ids} /> },
    { title: 'LINE', dataIndex: 'reach', render: (v: LineReach) => <Tag color={REACH_COLOR[v]}>{v}</Tag> },
  ];

  const audienceColumns: ColumnsType<LineAudience> = [
    { title: '受眾名稱', dataIndex: 'name' },
    { title: '人數', dataIndex: 'member_count', align: 'right', render: (v: number) => `${v} 人` },
    { title: '條件', key: 'filters', render: (_, a) => <Typography.Text type="secondary">{describeFilters(a.filters, coachName, branchList.nameOf)}</Typography.Text> },
    { title: '建立', key: 'created', render: (_, a) => `${formatServerTime(a.created_at)}・${a.created_by_name ?? ''}` },
  ];

  const createDisabledReason = !lineEnabled
    ? '請先在系統設定啟用 LINE 官方帳號'
    : !result?.sendable
      ? '名單裡沒有可以發送 LINE 訊息的會員'
      : null;

  return (
    <Flex vertical gap={16}>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          會員名單
        </Typography.Title>
        <Typography.Text type="secondary">依上課紀錄篩出會員，上傳成 LINE 受眾後，到 LINE 官方帳號後台發送優惠與活動訊息</Typography.Text>
      </div>

      {lineOa && !lineEnabled && (
        <Alert
          type="info"
          showIcon
          title="尚未啟用 LINE 官方帳號"
          description={
            <>
              目前只能篩選與匯出名單。要上傳成 LINE 受眾，請先到<Link to="/admin/settings">系統設定</Link>設定 LINE 官方帳號。
            </>
          }
        />
      )}

      <SegmentFilterCard
        value={draft}
        onChange={setDraft}
        onSearch={(f) => {
          setApplied(f);
          setReach('全部');
        }}
        coachOptions={coaches.map((c) => ({ value: c.id, label: c.name }))}
        branchOptions={branchList.branches.map((b) => ({ value: b.id, label: b.name }))}
        loading={isFetching}
      />

      <Card
        title="名單"
        extra={
          <Flex gap={8} wrap>
            <Button icon={<DownloadOutlined />} disabled={!members.length} onClick={() => downloadCsv(members)}>
              匯出 CSV
            </Button>
            <Button icon={<TagsOutlined />} disabled={!rows.length} onClick={() => setTagModalOpen(true)}>
              加上標籤
            </Button>
            <Tooltip title={createDisabledReason}>
              <Button type="primary" icon={<UsergroupAddOutlined />} disabled={!!createDisabledReason} onClick={() => setModalOpen(true)}>
                建立 LINE 受眾
              </Button>
            </Tooltip>
          </Flex>
        }
      >
        <Flex vertical gap={16}>
          <Flex gap={40} wrap>
            <Statistic title="符合條件" value={result?.total ?? 0} suffix="人" loading={isFetching && !result} />
            <Statistic title="可發送 LINE" value={result?.sendable ?? 0} suffix="人" />
            <Statistic title="未同意優惠訊息" value={result?.no_consent ?? 0} suffix="人" />
            <Statistic title="未綁定 LINE" value={result?.no_line ?? 0} suffix="人" />
          </Flex>
          <Typography.Text type="secondary">
            條件：{summary}。只有綁定 LINE、且在「我的」開啟「優惠與活動訊息」的會員會上傳；其他人可匯出後用電話或簡訊聯絡。
          </Typography.Text>
          <Segmented<ReachFilter>
            value={reach}
            onChange={setReach}
            options={[
              { value: '全部', label: `全部 ${result?.total ?? 0}` },
              { value: '可發送', label: `可發送 ${result?.sendable ?? 0}` },
              { value: '未同意優惠訊息', label: `未同意 ${result?.no_consent ?? 0}` },
              { value: '未綁定 LINE', label: `未綁定 ${result?.no_line ?? 0}` },
            ]}
            style={{ alignSelf: 'flex-start' }}
          />
          <Table
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={isFetching}
            scroll={{ x: 720 }}
            pagination={{ pageSize: 20, hideOnSinglePage: true, showTotal: (t) => `共 ${t} 人` }}
            locale={{ emptyText: <Empty description="沒有符合條件的會員" /> }}
          />
        </Flex>
      </Card>

      <Card title="已建立的 LINE 受眾">
        <Table
          rowKey="id"
          columns={audienceColumns}
          dataSource={audiences}
          scroll={{ x: 720 }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="還沒有建立受眾" /> }}
        />
      </Card>

      <Modal
        open={tagModalOpen}
        title={`幫名單上的 ${rows.length} 位會員加上標籤`}
        okText="加上標籤"
        cancelText="取消"
        okButtonProps={{ disabled: tagToAdd === null }}
        confirmLoading={tagMutation.isPending}
        onOk={() => tagToAdd !== null && tagMutation.mutate(tagToAdd)}
        onCancel={() => setTagModalOpen(false)}
        destroyOnHidden
      >
        <Flex vertical gap={12}>
          <Typography.Text type="secondary">
            {reach === '全部' ? '目前名單上的所有會員' : `目前名單上「${reach}」的會員`}
            都會加上這個標籤，原本就有的略過。之後可以在會員列表、會員名單依標籤篩選，或發最新消息給這群人。
          </Typography.Text>
          <Select
            aria-label="選擇標籤"
            placeholder="選擇標籤"
            value={tagToAdd ?? undefined}
            onChange={setTagToAdd}
            options={memberTags.tags.map((t) => ({ value: t.id, label: `${t.name}（目前 ${t.member_count} 人）` }))}
            notFoundContent={<Link to="/admin/member-tags">先到「會員標籤」新增標籤</Link>}
          />
        </Flex>
      </Modal>

      <CreateAudienceModal
        open={modalOpen}
        sendable={result?.sendable ?? 0}
        summary={summary}
        quota={quota}
        loading={createMutation.isPending}
        onCancel={() => setModalOpen(false)}
        onSubmit={(name) => createMutation.mutate(name)}
      />
    </Flex>
  );
}

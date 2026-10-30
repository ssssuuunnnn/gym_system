import { useState } from 'react';
import { App, Button, Card, Empty, Flex, Popconfirm, Segmented, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCoupon,
  issueCoupon,
  listCoupons,
  updateCoupon,
  type Coupon,
  type CouponInput,
  type CouponKind,
} from '../../../api/coupons';
import { apiErrorMessage } from '../../../api/errors';
import { listProducts } from '../../../api/products';
import { listMembers } from '../../../api/users';
import { CouponFormModal } from './components/CouponFormModal';
import { CouponUsageDrawer } from './components/CouponUsageDrawer';
import { IssueCouponModal } from './components/IssueCouponModal';
import { toInput, validityText } from './lib';

type KindFilter = CouponKind | '全部';
type Editing = { mode: 'new' } | { mode: 'edit'; coupon: Coupon } | null;

/**
 * 優惠券（ADR 0010）：折價券在購買方案時折抵金額；體驗券送一個方案的堂數。
 * 有公開代碼的會員可以自己輸入領取；沒有代碼的由這裡發給指定會員。
 */
export default function Coupons() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<KindFilter>('全部');
  const [editing, setEditing] = useState<Editing>(null);
  const [issuing, setIssuing] = useState<Coupon | null>(null);
  const [viewing, setViewing] = useState<Coupon | null>(null);

  const { data: coupons = [], isLoading } = useQuery({ queryKey: ['coupons'], queryFn: listCoupons });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: listMembers, enabled: issuing !== null });
  const rows = kind === '全部' ? coupons : coupons.filter((c) => c.kind === kind);
  const onError = (err: unknown) => message.error(apiErrorMessage(err));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['coupons'] });

  const saveMutation = useMutation({
    mutationFn: (v: CouponInput) => (editing?.mode === 'edit' ? updateCoupon(editing.coupon.id, v) : createCoupon(v)),
    onSuccess: (c) => {
      message.success(editing?.mode === 'edit' ? '已儲存' : `已建立「${c.name}」`);
      setEditing(null);
      refresh();
    },
    onError,
  });
  const activeMutation = useMutation({
    mutationFn: (c: Coupon) => updateCoupon(c.id, { ...toInput(c), is_active: !c.is_active }),
    onSuccess: (c) => {
      message.success(c.is_active ? '已啟用' : '已停用；已發出的券仍可在效期內使用');
      refresh();
    },
    onError,
  });
  const issueMutation = useMutation({
    mutationFn: ({ coupon, userIds }: { coupon: Coupon; userIds: number[] }) => issueCoupon(coupon.id, userIds),
    onSuccess: (res) => {
      setIssuing(null);
      refresh();
      if (!res.skipped.length) {
        message.success(`已發給 ${res.issued} 位會員`);
        return;
      }
      modal.info({
        title: res.issued ? `已發給 ${res.issued} 位會員，${res.skipped.length} 位沒有發` : '沒有發出任何一張',
        content: (
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {res.skipped.map((s) => (
              <li key={s.user_id}>
                {s.name}：{s.reason}
              </li>
            ))}
          </ul>
        ),
        okText: '知道了',
      });
    },
    onError,
  });

  const columns: ColumnsType<Coupon> = [
    {
      title: '名稱',
      key: 'name',
      render: (_, c) => (
        <Flex vertical>
          <span>{c.name}</span>
          {c.description && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {c.description}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    { title: '類型', dataIndex: 'kind', render: (k: CouponKind) => <Tag color={k === '體驗券' ? 'purple' : 'orange'}>{k}</Tag> },
    {
      title: '內容',
      key: 'summary',
      render: (_, c) => (
        <Flex vertical gap={4}>
          <span>{c.summary}</span>
          <Space size={4} wrap>
            {c.product_ids.length > 0 && <Tag>限 {c.product_ids.length} 個方案</Tag>}
            {c.new_member_only && <Tag color="blue">新會員限定</Tag>}
            {c.issue_on_line_join && <Tag color="green">LINE 新加入自動發</Tag>}
            {c.kind === '體驗券' && !c.counts_for_payout && <Tag>不計教練鐘點</Tag>}
          </Space>
        </Flex>
      ),
    },
    {
      title: '公開代碼',
      dataIndex: 'code',
      width: 170,
      render: (v: string | null) =>
        v ? (
          <Typography.Text code copyable={{ text: v, tooltips: ['複製', '已複製'] }} style={{ whiteSpace: 'nowrap' }}>
            {v}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">只由後台發放</Typography.Text>
        ),
    },
    { title: '有效期間', key: 'validity', render: (_, c) => validityText(c) },
    {
      title: '發出／使用',
      key: 'counts',
      align: 'right',
      render: (_, c) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {c.issued_count}
          {c.total_limit ? ` / ${c.total_limit}` : ''} 張・用 {c.used_count}
        </span>
      ),
    },
    {
      title: '啟用',
      key: 'active',
      render: (_, c) => (
        <Popconfirm
          title={c.is_active ? `停用「${c.name}」？` : `啟用「${c.name}」？`}
          description={c.is_active ? '停用後不能再發放或領取，已發出的券仍可在效期內使用。' : undefined}
          okText={c.is_active ? '停用' : '啟用'}
          cancelText="取消"
          onConfirm={() => activeMutation.mutateAsync(c)}
        >
          <Switch size="small" checked={c.is_active} aria-label={c.is_active ? '已啟用' : '已停用'} />
        </Popconfirm>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, c) => (
        <Space wrap>
          <Button size="small" onClick={() => setEditing({ mode: 'edit', coupon: c })}>
            編輯
          </Button>
          <Tooltip title={c.is_active ? undefined : '停用中不能發放'}>
            <Button size="small" type="primary" ghost disabled={!c.is_active} onClick={() => setIssuing(c)}>
              發給會員
            </Button>
          </Tooltip>
          <Button size="small" onClick={() => setViewing(c)}>
            發放紀錄
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-end" wrap gap={12}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            優惠券
          </Typography.Title>
          <Typography.Text type="secondary">
            折價券在會員購買方案時折抵金額；體驗券送一個方案的堂數，會員用了就能預約
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ mode: 'new' })}>
          新增優惠券
        </Button>
      </Flex>

      <Card>
        <Flex vertical gap={16}>
          <Segmented<KindFilter>
            value={kind}
            onChange={setKind}
            options={['全部', '折價券', '體驗券']}
            style={{ alignSelf: 'flex-start' }}
          />
          <Table
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={isLoading}
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            locale={{ emptyText: <Empty description="還沒有優惠券" /> }}
          />
        </Flex>
      </Card>

      <CouponFormModal
        open={editing !== null}
        editing={editing?.mode === 'edit' ? editing.coupon : null}
        products={products}
        saving={saveMutation.isPending}
        onCancel={() => setEditing(null)}
        onSubmit={(v) => saveMutation.mutate(v)}
      />
      <IssueCouponModal
        coupon={issuing}
        members={members}
        saving={issueMutation.isPending}
        onCancel={() => setIssuing(null)}
        onSubmit={(userIds) => issuing && issueMutation.mutate({ coupon: issuing, userIds })}
      />
      <CouponUsageDrawer coupon={viewing} onClose={() => setViewing(null)} />
    </Flex>
  );
}

import { App, Button, Drawer, Popconfirm, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCouponUsage, voidMemberCoupon, type Coupon, type MemberCoupon, type MemberCouponStatus } from '../../../../api/coupons';
import { apiErrorMessage } from '../../../../api/errors';
import { formatServerTime } from '../../../../lib/datetime';

const STATUS_COLOR: Record<MemberCouponStatus, string> = { 可使用: 'processing', 已使用: 'success', 已過期: 'default', 已作廢: 'error' };

export interface CouponUsageDrawerProps {
  coupon: Coupon | null;
  onClose: () => void;
}

/** 一張券的發放與使用紀錄；還沒用的可以作廢 */
export function CouponUsageDrawer({ coupon, onClose }: CouponUsageDrawerProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['coupon-usage', coupon?.id],
    queryFn: () => listCouponUsage(coupon!.id),
    enabled: coupon !== null,
  });
  const voidMutation = useMutation({
    mutationFn: (mc: MemberCoupon) => voidMemberCoupon(mc.id, null),
    onSuccess: () => {
      message.success('已作廢');
      queryClient.invalidateQueries({ queryKey: ['coupon-usage'] });
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  const columns: ColumnsType<MemberCoupon> = [
    { title: '會員', dataIndex: 'member_name' },
    { title: '狀態', dataIndex: 'status', render: (s: MemberCouponStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag> },
    {
      title: '來源',
      key: 'source',
      render: (_, mc) => (
        <>
          {mc.source}
          {mc.issued_by_name && (
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              {mc.issued_by_name}
            </Typography.Text>
          )}
        </>
      ),
    },
    { title: '發出', dataIndex: 'issued_at', render: (v: string) => formatServerTime(v, 'YYYY/MM/DD') },
    { title: '到期', dataIndex: 'expires_on', render: (v: string | null) => v ?? '不限' },
    {
      title: '使用',
      key: 'used',
      render: (_, mc) =>
        mc.status === '已作廢' ? (
          <Typography.Text type="secondary">{mc.void_reason || '—'}</Typography.Text>
        ) : mc.used_at ? (
          formatServerTime(mc.used_at, 'YYYY/MM/DD HH:mm')
        ) : (
          '—'
        ),
    },
    {
      title: '',
      key: 'actions',
      render: (_, mc) =>
        mc.status === '可使用' ? (
          <Popconfirm
            title={`作廢「${mc.member_name}」的這張券？`}
            okText="作廢"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => voidMutation.mutateAsync(mc)}
          >
            <Button size="small" danger>
              作廢
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <Drawer open={coupon !== null} onClose={onClose} title={coupon ? `「${coupon.name}」發放紀錄` : ''} size={720}>
      <Table rowKey="id" size="small" columns={columns} dataSource={data} loading={isLoading} pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 640 }} />
    </Drawer>
  );
}

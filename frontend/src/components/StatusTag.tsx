import { Tag } from 'antd';

/**
 * 狀態標籤，對應「共用元件」章節：預約的待確認／已確認／已拒絕／已取消，
 * 以及購買紀錄付款狀態的待付款／已付款（已取消共用）。
 */
const STATUS_COLOR: Record<string, string> = {
  待確認: 'default',
  已確認: 'blue',
  已拒絕: 'default',
  已取消: 'default',
  待付款: 'gold',
  已付款: 'green',
};

export default function StatusTag({ status }: { status: string }) {
  return <Tag color={STATUS_COLOR[status] ?? 'default'}>{status}</Tag>;
}

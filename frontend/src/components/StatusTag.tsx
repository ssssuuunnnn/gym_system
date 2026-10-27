import { Tag } from 'antd';

/**
 * 狀態標籤，對應「共用元件」章節：預約的待確認／已確認／已拒絕／已取消，
 * 購買紀錄付款狀態的待付款／已付款（已取消共用），出席狀態的已出席／未到、晚取消，教練鐘點的已結算／已撥款，
 * 以及平台管理後台的健身房狀態 試用／啟用／停用。
 */
const STATUS_COLOR: Record<string, string> = {
  待確認: 'default',
  已確認: 'blue',
  已拒絕: 'default',
  已取消: 'default',
  待付款: 'gold',
  已付款: 'green',
  已出席: 'green',
  未到: 'red',
  晚取消: 'orange',
  已結算: 'blue',
  已撥款: 'green',
  試用: 'gold',
  啟用: 'green',
  停用: 'red',
};

export default function StatusTag({ status }: { status: string }) {
  return <Tag color={STATUS_COLOR[status] ?? 'default'}>{status}</Tag>;
}

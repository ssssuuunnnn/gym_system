import React from 'react';
// 預約狀態標籤：對應 reservations.status 的四個值（待確認／已確認／已拒絕／已取消）。
// 每個狀態固定對應設計系統 Tag 的語意色，呼叫端不需自行指定顏色。
const STATUS_COLOR = { '待確認': 'warning', '已確認': 'success', '已拒絕': 'error', '已取消': 'default' };
export function StatusTag(props) {
  const { status } = props;
  const ns = (typeof window !== 'undefined' && window.PulseFitDesignSystem_325e30) || {};
  const Tag = ns.Tag;
  const color = STATUS_COLOR[status] || 'default';
  if (!Tag) return React.createElement('span', { style: { fontFamily: 'var(--font-family)', fontSize: 12 } }, status);
  return React.createElement(Tag, { color: color }, status);
}

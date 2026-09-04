import React from 'react';
export interface StatusTagProps {
  /** 預約狀態，對應 reservations.status */
  status: '待確認' | '已確認' | '已拒絕' | '已取消' | (string & {});
}
export function StatusTag(props: StatusTagProps): JSX.Element;

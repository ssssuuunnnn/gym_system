import { useEffect, useState } from 'react';
import { theme } from 'antd';
import { useSearchParams } from 'react-router-dom';

/**
 * 從通知點進列表頁時，依網址 ?highlight=<id> 跳到那一列所在的分頁、捲到畫面中間並加底色。
 * 回傳的 onRow / pagination 直接給 antd Table；沒有 highlight 時就是一般的分頁。
 */
export function useHighlightRow<T extends { id: number }>(rows: T[] | undefined, pageSize: number) {
  const { token } = theme.useToken();
  const [params] = useSearchParams();
  const highlightId = Number(params.get('highlight')) || null;
  const [page, setPage] = useState(1);
  const index = highlightId && rows ? rows.findIndex((r) => r.id === highlightId) : -1;

  useEffect(() => {
    if (index < 0) return;
    setPage(Math.floor(index / pageSize) + 1);
    const timer = window.setTimeout(() => {
      document.querySelector(`tr[data-row-key="${highlightId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [highlightId, index, pageSize]);

  return {
    highlightId,
    /** 這一列是否為通知指向的那一筆 */
    isHighlighted: (row: T) => row.id === highlightId,
    rowStyle: (row: T) => (row.id === highlightId ? { background: token.colorWarningBg } : undefined),
    pagination: { current: page, onChange: (p: number) => setPage(p), pageSize },
  };
}

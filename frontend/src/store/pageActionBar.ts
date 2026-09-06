import { create } from 'zustand';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

/**
 * 版面級底部操作列：頁面透過 `usePageActionBar` 提供內容，由 `AppLayout` 統一渲染
 * 成 sticky 在視窗底部的操作列（比照 Header 的固定方式），離開頁面時自動清空。
 */
interface PageActionBarState {
  content: ReactNode | null;
  setPageActionBar: (content: ReactNode | null) => void;
}

export const usePageActionBarStore = create<PageActionBarState>((set) => ({
  content: null,
  setPageActionBar: (content) => set({ content }),
}));

export function usePageActionBar(content: ReactNode | null) {
  const setPageActionBar = usePageActionBarStore((s) => s.setPageActionBar);
  useEffect(() => {
    setPageActionBar(content);
    return () => setPageActionBar(null);
  }, [content, setPageActionBar]);
}

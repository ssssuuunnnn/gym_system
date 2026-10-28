import { Drawer } from 'antd';
import type { ReactNode } from 'react';
import { FRONT_MAX_WIDTH } from './memberTheme';

export interface BottomSheetProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** 前台底部面板：圓角、寬度與前台內容欄一致。確認預約、購買方案共用。 */
export default function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="bottom"
      size="auto"
      title={title}
      closable={false}
      styles={{
        wrapper: { maxWidth: FRONT_MAX_WIDTH, marginInline: 'auto', borderRadius: '24px 24px 0 0', overflow: 'hidden' },
        header: { borderBottom: 'none', paddingBottom: 0 },
        title: { fontSize: 20, fontWeight: 700 },
        body: { paddingTop: 12 },
      }}
    >
      {children}
    </Drawer>
  );
}

import { useState } from 'react';
import { Alert, Input, Modal, Select } from 'antd';
import type { StaffAccount } from '../../../../api/staff';

export interface TransferOwnerModalProps {
  open: boolean;
  candidates: StaffAccount[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (userId: number, password: string) => void;
}

/** 移交主要管理者：選一個啟用中的後台帳號，再輸入一次自己的密碼 */
export function TransferOwnerModal({ open, candidates, saving, onCancel, onSubmit }: TransferOwnerModalProps) {
  const [userId, setUserId] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  return (
    <Modal
      open={open}
      title="移交主要管理者"
      okText="確認移交"
      okButtonProps={{ danger: true, disabled: userId == null || !password }}
      cancelText="取消"
      confirmLoading={saving}
      onCancel={onCancel}
      onOk={() => userId != null && onSubmit(userId, password)}
      afterOpenChange={(v) => {
        if (!v) {
          setUserId(null);
          setPassword('');
        }
      }}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Alert type="warning" showIcon title="移交後你會變成管理者，不能再管理後台帳號與權限" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="transfer-target">新的主要管理者</label>
          <Select
            id="transfer-target"
            placeholder="選擇後台帳號"
            value={userId ?? undefined}
            onChange={setUserId}
            options={candidates.map((s) => ({ value: s.id, label: `${s.display_name || s.username}（${s.level}）` }))}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="transfer-password">你的密碼</label>
          <Input.Password id="transfer-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
      </div>
    </Modal>
  );
}

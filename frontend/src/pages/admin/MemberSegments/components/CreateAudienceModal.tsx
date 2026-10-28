import { useState } from 'react';
import { Alert, Input, Modal, Typography } from 'antd';
import dayjs from 'dayjs';
import type { LineOaQuota } from '../../../../api/lineOa';

export interface CreateAudienceModalProps {
  open: boolean;
  /** 會上傳的人數（名單中「可發送」的會員） */
  sendable: number;
  /** 篩選條件摘要 */
  summary: string;
  quota?: LineOaQuota;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}

/** 建立 LINE 受眾：取名字、看人數與本月額度後送出 */
export function CreateAudienceModal({ open, sendable, summary, quota, loading, onCancel, onSubmit }: CreateAudienceModalProps) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const remaining = quota?.limited && quota.limit != null && quota.used != null ? quota.limit - quota.used : null;

  return (
    <Modal
      open={open}
      title="建立 LINE 受眾"
      okText="建立受眾"
      cancelText="取消"
      okButtonProps={{ disabled: !trimmed, loading }}
      onCancel={onCancel}
      onOk={() => onSubmit(trimmed)}
      afterOpenChange={(visible) => visible && setName(`${dayjs().format('YYYY-MM')} 會員名單`)}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="audience-name">受眾名稱（在 LINE 官方帳號後台會看到這個名字）</label>
          <Input id="audience-name" value={name} maxLength={50} showCount onChange={(e) => setName(e.target.value)} />
        </div>
        <Typography.Paragraph style={{ margin: 0 }}>
          會上傳 <strong>{sendable}</strong> 位已綁定 LINE、且同意接收優惠訊息的會員。
          <br />
          <Typography.Text type="secondary">條件：{summary}</Typography.Text>
        </Typography.Paragraph>
        <Alert
          type="info"
          showIcon
          title="建立受眾不會發送訊息、也不計費"
          description={
            <>
              建立後到 LINE 官方帳號後台建立群發訊息，傳送對象選「篩選目標」→「受眾」→ 這個名稱。受眾可能要幾分鐘才能使用。
              <br />
              群發時每送一人算一則，這次約用掉 {sendable} 則
              {remaining != null && `；本月額度還剩 ${remaining} 則`}
              {quota?.limited === false && '；你的方案沒有則數上限'}。
            </>
          }
        />
        {remaining != null && remaining < sendable && (
          <Alert type="warning" showIcon title={`本月剩餘額度（${remaining} 則）不夠送給所有人，超過的部分 LINE 會拒絕發送或另外計費`} />
        )}
      </div>
    </Modal>
  );
}

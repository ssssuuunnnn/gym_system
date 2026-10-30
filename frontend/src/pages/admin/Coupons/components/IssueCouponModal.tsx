import { useState } from 'react';
import { Modal, Select, Typography } from 'antd';
import type { Coupon } from '../../../../api/coupons';
import type { Member } from '../../../../api/users';

export interface IssueCouponModalProps {
  coupon: Coupon | null;
  members: Member[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (userIds: number[]) => void;
}

/** 把券發給指定會員（可多選）；不符合條件的會員後端會略過並說明原因 */
export function IssueCouponModal({ coupon, members, saving, onCancel, onSubmit }: IssueCouponModalProps) {
  const [userIds, setUserIds] = useState<number[]>([]);
  const options = members
    .filter((m) => m.role === 'member' && !m.is_blacklisted)
    .map((m) => ({
      value: m.id,
      label: [m.display_name || m.username, m.display_name ? m.username : null, m.phone].filter(Boolean).join('・'),
    }));

  return (
    <Modal
      open={coupon !== null}
      title={coupon ? `發送「${coupon.name}」` : ''}
      okText={userIds.length ? `發給 ${userIds.length} 位會員` : '發送'}
      okButtonProps={{ disabled: !userIds.length }}
      cancelText="取消"
      confirmLoading={saving}
      onCancel={onCancel}
      onOk={() => onSubmit(userIds)}
      afterClose={() => setUserIds([])}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">{coupon?.summary}。券會出現在會員的「我的優惠券」裡。</Typography.Paragraph>
      <label htmlFor="issue-members" style={{ display: 'block', marginBottom: 4 }}>
        會員（可搜尋姓名、帳號、手機）
      </label>
      <Select
        id="issue-members"
        mode="multiple"
        allowClear
        style={{ width: '100%' }}
        placeholder="選擇會員"
        value={userIds}
        onChange={setUserIds}
        options={options}
        optionFilterProp="label"
      />
    </Modal>
  );
}

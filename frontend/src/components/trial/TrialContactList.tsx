import { Button, Flex, Typography } from 'antd';
import { MailOutlined, MessageOutlined, PhoneOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import type { PlatformContact } from '../../api/tenant';

export interface TrialContactListProps {
  contact: PlatformContact;
  /** 排列方向：到期頁置中直排、提示框橫排 */
  vertical?: boolean;
  style?: CSSProperties;
}

/** 平台的聯絡方式（只會有平台設定為顯示的欄位）；都沒有時顯示一句提示。 */
export function TrialContactList({ contact, vertical, style }: TrialContactListProps) {
  const items = [
    contact.line_url && (
      <Button key="line" type="primary" icon={<MessageOutlined />} href={contact.line_url} target="_blank" rel="noopener">
        LINE {contact.line}
      </Button>
    ),
    contact.phone && (
      <Button key="phone" icon={<PhoneOutlined />} href={`tel:${contact.phone.replace(/[\s-]/g, '')}`}>
        {contact.phone}
      </Button>
    ),
    contact.email && (
      <Button key="email" icon={<MailOutlined />} href={`mailto:${contact.email}`}>
        {contact.email}
      </Button>
    ),
  ].filter(Boolean);
  if (items.length === 0) {
    return <Typography.Text type="secondary">請聯絡 {contact.brand_name} 的服務人員。</Typography.Text>;
  }
  return (
    <Flex gap={8} wrap vertical={vertical} align={vertical ? 'center' : undefined} style={style}>
      {items}
    </Flex>
  );
}

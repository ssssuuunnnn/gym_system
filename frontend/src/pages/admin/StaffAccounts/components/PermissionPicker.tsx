import { Button, Checkbox, Flex, Tag, Typography, theme } from 'antd';
import type { PermissionCode, StaffMeta } from '../../../../api/staff';

export interface PermissionPickerProps {
  meta: StaffMeta;
  value: PermissionCode[];
  onChange: (value: PermissionCode[]) => void;
}

/** 一般使用者的功能勾選：角色範本一鍵帶入，再逐項微調；含敏感資料的功能加上標記 */
export function PermissionPicker({ meta, value, onChange }: PermissionPickerProps) {
  const { token } = theme.useToken();
  const selected = new Set(value);
  const toggle = (code: PermissionCode, on: boolean) =>
    onChange(meta.permissions.map((p) => p.code).filter((c) => (c === code ? on : selected.has(c))));

  return (
    <Flex vertical gap={12}>
      <Flex gap={8} wrap align="center">
        <Typography.Text type="secondary">套用範本：</Typography.Text>
        {meta.templates.map((t) => (
          <Button key={t.key} size="small" onClick={() => onChange(t.codes)}>
            {t.label}
          </Button>
        ))}
        <Button size="small" type="text" onClick={() => onChange([])}>
          全部清除
        </Button>
      </Flex>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {meta.permissions.map((p) => (
          <label
            key={p.code}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              padding: '8px 10px',
              borderRadius: token.borderRadius,
              border: `1px solid ${selected.has(p.code) ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
              background: selected.has(p.code) ? token.colorPrimaryBg : token.colorBgContainer,
              cursor: 'pointer',
            }}
          >
            <Checkbox checked={selected.has(p.code)} onChange={(e) => toggle(p.code, e.target.checked)} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span>
                {p.label}
                {p.sensitive && (
                  <Tag color="warning" style={{ marginInlineStart: 6 }}>
                    含敏感資料
                  </Tag>
                )}
              </span>
              <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{p.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </Flex>
  );
}

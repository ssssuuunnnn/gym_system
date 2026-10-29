import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Radio, Space, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { AssignableLevel, PermissionCode, StaffAccount, StaffMeta } from '../../../../api/staff';
import { generatePassword } from '../../../../lib/password';
import { PermissionPicker } from './PermissionPicker';

export interface StaffFormValues {
  username: string;
  display_name: string;
  password: string;
  level: AssignableLevel;
  permissions: PermissionCode[];
}

export interface StaffFormModalProps {
  open: boolean;
  /** 編輯時帶入；新增時為 null */
  editing: StaffAccount | null;
  meta: StaffMeta;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: StaffFormValues) => void;
}

/** 新增後台帳號／編輯名稱、身分與功能權限 */
export function StaffFormModal({ open, editing, meta, saving, onCancel, onSubmit }: StaffFormModalProps) {
  const [form] = Form.useForm<StaffFormValues>();
  const level = Form.useWatch('level', form);
  const [perms, setPerms] = useState<PermissionCode[]>([]);

  useEffect(() => {
    if (!open) return;
    const initial: PermissionCode[] = editing ? (editing.level === '一般使用者' ? editing.permissions : []) : meta.templates[0]?.codes ?? [];
    setPerms(initial);
    form.setFieldsValue({
      username: editing?.username ?? '',
      display_name: editing?.display_name ?? '',
      password: editing ? '' : generatePassword(),
      level: editing?.level === '管理者' ? '管理者' : '一般使用者',
    });
  }, [open, editing, meta, form]);

  return (
    <Modal
      open={open}
      title={editing ? `編輯「${editing.display_name || editing.username}」` : '新增後台帳號'}
      okText={editing ? '儲存' : '建立帳號'}
      cancelText="取消"
      width={720}
      confirmLoading={saving}
      onCancel={onCancel}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form<StaffFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={(v) => onSubmit({ ...v, permissions: perms })}
      >
        {!editing && (
          <Form.Item label="帳號" name="username" rules={[{ required: true, whitespace: true, message: '請輸入帳號' }]}>
            <Input maxLength={100} autoComplete="off" />
          </Form.Item>
        )}
        <Form.Item label="名稱" name="display_name" extra="例如員工姓名，會顯示在操作紀錄">
          <Input maxLength={50} />
        </Form.Item>
        {!editing && (
          <Form.Item label="初始密碼" required extra="建立後只會顯示這一次；對方第一次登入要自己修改">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="password" noStyle rules={[{ required: true, min: 8, message: '至少 8 個字元' }]}>
                <Input />
              </Form.Item>
              <Button icon={<ReloadOutlined />} onClick={() => form.setFieldValue('password', generatePassword())}>
                重新產生
              </Button>
            </Space.Compact>
          </Form.Item>
        )}
        <Form.Item label="身分" name="level">
          <Radio.Group
            options={[
              { value: '一般使用者', label: '一般使用者（只能用勾選的功能）' },
              { value: '管理者', label: '管理者（全部功能，但不能管理後台帳號）' },
            ]}
          />
        </Form.Item>
        {level === '一般使用者' ? (
          <Form.Item label="可以使用的功能">
            <PermissionPicker meta={meta} value={perms} onChange={setPerms} />
          </Form.Item>
        ) : (
          <Typography.Paragraph type="secondary">管理者可以使用全部功能，包含含敏感資料的教練鐘點與系統設定。</Typography.Paragraph>
        )}
      </Form>
    </Modal>
  );
}

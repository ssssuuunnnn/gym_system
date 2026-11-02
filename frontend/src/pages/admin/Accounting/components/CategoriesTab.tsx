import { useState } from 'react';
import { App, Button, Card, Col, Input, List, Popconfirm, Row, Space, Switch, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCategory,
  deleteCategory,
  ENTRY_KINDS,
  listCategories,
  updateCategory,
  type AccountingCategory,
  type EntryKind,
} from '../../../../api/accounting';
import { apiErrorMessage } from '../../../../api/errors';

/** 一種收支的分類清單：新增、改名（點名稱直接編輯）、停用、刪除沒用過的 */
function CategoryList({ kind, items }: { kind: EntryKind; items: AccountingCategory[] }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['accounting-categories'] });
  const onError = (error: unknown) => message.error(apiErrorMessage(error));

  const create = useMutation({
    mutationFn: () => createCategory({ kind, name: name.trim() }),
    onSuccess: () => {
      setName('');
      refresh();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, ...payload }: { id: number; name?: string; is_active?: boolean }) => updateCategory(id, payload),
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({ mutationFn: deleteCategory, onSuccess: refresh, onError });

  return (
    <Card size="small" title={`${kind}分類`}>
      <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
        <Input
          value={name}
          maxLength={30}
          placeholder={`新增${kind}分類`}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={() => name.trim() && create.mutate()}
        />
        <Button type="primary" disabled={!name.trim()} loading={create.isPending} onClick={() => create.mutate()}>
          新增
        </Button>
      </Space.Compact>
      <List
        size="small"
        dataSource={items}
        renderItem={(c) => (
          <List.Item
            actions={[
              <Switch
                key="active"
                size="small"
                checked={c.is_active}
                checkedChildren="啟用"
                unCheckedChildren="停用"
                onChange={(is_active) => update.mutate({ id: c.id, is_active })}
              />,
              c.in_use ? (
                <Typography.Text key="used" type="secondary" style={{ fontSize: 12 }}>
                  已使用
                </Typography.Text>
              ) : (
                <Popconfirm key="delete" title={`刪除「${c.name}」？`} onConfirm={() => remove.mutate(c.id)}>
                  <Button type="link" size="small" danger>
                    刪除
                  </Button>
                </Popconfirm>
              ),
            ]}
          >
            <Space>
              <Typography.Text
                editable={{
                  maxLength: 30,
                  triggerType: ['text', 'icon'],
                  onChange: (v) => v.trim() && v.trim() !== c.name && update.mutate({ id: c.id, name: v.trim() }),
                }}
                type={c.is_active ? undefined : 'secondary'}
              >
                {c.name}
              </Typography.Text>
              {!c.is_active && <Tag>停用</Tag>}
            </Space>
          </List.Item>
        )}
      />
    </Card>
  );
}

/** 分類設定：收入、支出各一組；用過的分類只能停用（R59） */
export function CategoriesTab() {
  const categories = useQuery({ queryKey: ['accounting-categories'], queryFn: listCategories });
  return (
    <Row gutter={[16, 16]}>
      {ENTRY_KINDS.map((kind) => (
        <Col key={kind} xs={24} md={12}>
          <CategoryList kind={kind} items={(categories.data ?? []).filter((c) => c.kind === kind)} />
        </Col>
      ))}
    </Row>
  );
}

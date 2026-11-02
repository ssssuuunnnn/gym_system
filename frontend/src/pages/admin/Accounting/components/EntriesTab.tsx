import { useState } from 'react';
import { App, Button, Popconfirm, Space, Switch, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEntry,
  deleteEntry,
  listCategories,
  listEntries,
  updateEntry,
  type AccountingEntry,
  type EntryPayload,
} from '../../../../api/accounting';
import { apiErrorMessage } from '../../../../api/errors';
import type { Branch } from '../../../../api/branches';
import { formatServerTime } from '../../../../lib/datetime';
import { ACCOUNTING_KEYS, isClosedDay, money, type Range } from '../lib';
import { ReceiptActions } from './ReceiptActions';
import { useClosedMonths } from './useClosedMonths';
import { EntryFormModal } from './EntryFormModal';

export interface EntriesTabProps {
  range: Range;
  branchId: number | null;
  branches: Branch[];
  branchName: (id: number | null) => string;
}

/** 手動記帳：期間內的帳目列表（依報表選的分店篩選），新增、修改、刪除（保留紀錄） */
export function EntriesTab({ range, branchId, branches, branchName }: EntriesTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [showDeleted, setShowDeleted] = useState(false);
  const [editing, setEditing] = useState<AccountingEntry | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const period = {
    start: range[0].format('YYYY-MM-DD'),
    end: range[1].format('YYYY-MM-DD'),
    branch_id: branchId,
    include_deleted: showDeleted,
  };
  const entries = useQuery({ queryKey: ['accounting-entries', period], queryFn: () => listEntries(period) });
  const categories = useQuery({ queryKey: ['accounting-categories'], queryFn: listCategories });
  const closed = useClosedMonths();

  const refresh = () => ACCOUNTING_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));

  const save = useMutation({
    mutationFn: (payload: EntryPayload) => (editing ? updateEntry(editing.id, payload) : createEntry(payload)),
    onSuccess: () => {
      message.success(editing ? '已更新帳目' : '已新增帳目');
      setFormOpen(false);
      setEditing(null);
      refresh();
    },
    onError: (error) => message.error(apiErrorMessage(error, '儲存失敗，請稍後再試')),
  });

  const remove = useMutation({
    mutationFn: deleteEntry,
    onSuccess: () => {
      message.success('已刪除帳目');
      refresh();
    },
    onError: (error) => message.error(apiErrorMessage(error, '刪除失敗，請稍後再試')),
  });

  const columns: ColumnsType<AccountingEntry> = [
    { title: '日期', dataIndex: 'entry_date', width: 110 },
    {
      title: '收支',
      dataIndex: 'kind',
      width: 72,
      render: (kind: string) => <Tag color={kind === '收入' ? 'blue' : 'orange'}>{kind}</Tag>,
    },
    { title: '分類', dataIndex: 'category_name' },
    { title: '金額', dataIndex: 'amount', align: 'right', render: (v: number) => money(v) },
    { title: '付款方式', dataIndex: 'payment_method', width: 88 },
    {
      title: '分店',
      dataIndex: 'branch_id',
      render: (id: number | null) => (id == null ? <Typography.Text type="secondary">全店共同</Typography.Text> : branchName(id)),
    },
    { title: '備註', dataIndex: 'note', ellipsis: true, render: (n: string | null) => n ?? '—' },
    {
      title: '收據',
      key: 'receipt',
      render: (_, e) => <ReceiptActions entry={e} locked={!!e.deleted_at || isClosedDay(closed, e.entry_date)} />,
    },
    {
      title: '記錄者',
      key: 'by',
      render: (_, e) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {e.deleted_at
            ? `${e.deleted_by_name ?? ''} 刪除於 ${formatServerTime(e.deleted_at)}`
            : `${e.updated_by_name ?? e.created_by_name ?? ''}・${formatServerTime(e.updated_at)}`}
        </Typography.Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, e) =>
        e.deleted_at ? (
          <Tag>已刪除</Tag>
        ) : isClosedDay(closed, e.entry_date) ? (
          <Tag>已關帳</Tag>
        ) : (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setEditing(e);
                setFormOpen(true);
              }}
            >
              修改
            </Button>
            <Popconfirm title="刪除這筆帳目？" description="會保留刪除紀錄，報表不再計入" onConfirm={() => remove.mutate(e.id)}>
              <Button type="link" size="small" danger>
                刪除
              </Button>
            </Popconfirm>
          </Space>
        ),
    },
  ];

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
        <Typography.Text type="secondary">
          系統沒有記錄的收入與支出，例如房租、水電、場租收入。方案銷售與鐘點撥款會自動計入，不用重複記；已關帳的月份不能再修改。
        </Typography.Text>
        <Space>
          <Space size={6}>
            <Switch size="small" checked={showDeleted} onChange={setShowDeleted} id="show-deleted" />
            <label htmlFor="show-deleted">顯示已刪除</label>
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            新增帳目
          </Button>
        </Space>
      </Space>

      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={entries.data}
        loading={entries.isLoading}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 20, showTotal: (n) => `共 ${n} 筆` }}
        locale={{ emptyText: '這段期間沒有手動帳目' }}
      />

      <EntryFormModal
        open={formOpen}
        entry={editing}
        categories={categories.data ?? []}
        branches={branches}
        closedMonths={closed}
        defaultBranchId={branchId}
        saving={save.isPending}
        onSubmit={(payload) => save.mutate(payload)}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Timeline,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { listCouponOptions } from '../../api/coupons';
import {
  addInquiryNote,
  convertInquiry,
  INQUIRY_STATUSES,
  listInquiries,
  updateInquiryStatus,
  type Inquiry,
  type InquiryStatus,
} from '../../api/inquiries';
import { apiErrorMessage } from '../../api/errors';
import StatusTag from '../../components/StatusTag';
import { showCredentials } from '../../components/credentials';
import { formatServerTime } from '../../lib/datetime';
import { generatePassword, MIN_PASSWORD_LENGTH } from '../../lib/password';

type Filter = InquiryStatus | '全部';

interface ConvertValues {
  username: string;
  password: string;
  must_change_password: boolean;
  /** 同時送的體驗券（ADR 0010） */
  coupon_id?: number | null;
}

/**
 * 詢問名單（見 docs/adr/0003-gym-website.md）：形象網站「預約體驗課」表單送出的資料。
 * 點一筆打開右側抽屜跟進：改狀態、寫跟進紀錄、建立會員帳號。
 */
export default function Inquiries() {
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const [filter, setFilter] = useState<Filter>('全部');
  const [openId, setOpenId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertForm] = Form.useForm<ConvertValues>();

  const { data: inquiries = [], isLoading } = useQuery({ queryKey: ['inquiries'], queryFn: () => listInquiries() });
  // 從鈴鐺通知點進來（?highlight=<id>）：直接打開那一筆
  const [params] = useSearchParams();
  const highlightId = Number(params.get('highlight')) || null;
  const highlightLoaded = inquiries.some((i) => i.id === highlightId);
  useEffect(() => {
    if (highlightId && highlightLoaded) {
      setFilter('全部');
      setOpenId(highlightId);
    }
  }, [highlightId, highlightLoaded]);
  const counts = useMemo(() => {
    const m = new Map<InquiryStatus, number>();
    inquiries.forEach((i) => m.set(i.status, (m.get(i.status) ?? 0) + 1));
    return m;
  }, [inquiries]);
  const rows = filter === '全部' ? inquiries : inquiries.filter((i) => i.status === filter);
  const selected = inquiries.find((i) => i.id === openId) ?? null;

  const refresh = (updated: Inquiry) => {
    queryClient.setQueryData<Inquiry[]>(['inquiries'], (old) => old?.map((i) => (i.id === updated.id ? updated : i)));
    queryClient.invalidateQueries({ queryKey: ['inquiries-summary'] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: InquiryStatus }) => updateInquiryStatus(id, status),
    onSuccess: refresh,
    onError: (err) => message.error(apiErrorMessage(err)),
  });
  const noteMutation = useMutation({
    mutationFn: ({ id, text }: { id: number; text: string }) => addInquiryNote(id, text),
    onSuccess: (updated) => {
      refresh(updated);
      setNote('');
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });
  const convertMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: ConvertValues }) => convertInquiry(id, values),
    onSuccess: (updated, { values }) => {
      refresh(updated);
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setConvertOpen(false);
      showCredentials(modal, {
        title: `已建立「${updated.name}」的會員帳號`,
        credentials: {
          loginUrl: `${window.location.origin}/login`,
          username: values.username,
          password: values.password,
          mustChangePassword: values.must_change_password,
        },
      });
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  // 轉為會員時可以順便送體驗券：預設選最新一張啟用中的體驗券
  const { data: trialCoupons = [] } = useQuery({
    queryKey: ['coupon-options', '體驗券'],
    queryFn: () => listCouponOptions('體驗券'),
    enabled: convertOpen,
  });
  useEffect(() => {
    if (convertOpen && trialCoupons.length && convertForm.getFieldValue('coupon_id') === undefined) {
      convertForm.setFieldValue('coupon_id', trialCoupons[0].id);
    }
  }, [convertOpen, trialCoupons, convertForm]);

  const openConvert = (inquiry: Inquiry) => {
    convertForm.setFieldsValue({
      username: inquiry.phone.replace(/\D/g, ''),
      password: generatePassword(),
      must_change_password: true,
      coupon_id: undefined,
    });
    setConvertOpen(true);
  };

  const columns: ColumnsType<Inquiry> = [
    { title: '送出時間', dataIndex: 'created_at', width: 150, render: (v: string) => formatServerTime(v) },
    {
      title: '姓名',
      dataIndex: 'name',
      render: (v: string, i) => (
        <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => setOpenId(i.id)}>
          {v}
        </Button>
      ),
    },
    { title: '手機', dataIndex: 'phone', width: 140 },
    { title: '想體驗', dataIndex: 'interest', render: (v: string | null) => v ?? '—' },
    { title: '方便時段', dataIndex: 'preferred_slot', width: 110, render: (v: string | null) => v ?? '—' },
    { title: '跟進', key: 'notes', width: 80, align: 'right', render: (_, i) => i.notes.length || '—' },
    { title: '狀態', dataIndex: 'status', width: 110, render: (s: InquiryStatus) => <StatusTag status={s} /> },
  ];

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            詢問名單
          </Typography.Title>
          <Typography.Text type="secondary">
            <Link to="/admin/website">形象網站</Link>「預約體驗課」表單送出的資料
          </Typography.Text>
        </div>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: '全部', label: `全部 ${inquiries.length}` },
            ...INQUIRY_STATUSES.map((s) => ({ value: s, label: `${s} ${counts.get(s) ?? 0}` })),
          ]}
        />
      </div>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={isLoading}
          scroll={{ x: 760 }}
          onRow={(i) => ({ onClick: () => setOpenId(i.id), style: { cursor: 'pointer' } })}
          pagination={{ pageSize: 20, hideOnSinglePage: true, showTotal: (t) => `共 ${t} 筆` }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={inquiries.length ? '沒有符合條件的詢問' : '還沒有詢問。網站發布後，訪客送出的體驗課預約會出現在這裡。'}
              />
            ),
          }}
        />
      </Card>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        個資保存：沒有成為會員的詢問，送出 6 個月後自動刪除（與網站上的個資告知事項一致）。
      </Typography.Text>

      <Drawer
        open={selected !== null}
        onClose={() => setOpenId(null)}
        width={480}
        title={
          selected && (
            <Space>
              {selected.name}
              <StatusTag status={selected.status} />
            </Space>
          )
        }
      >
        {selected && (
          <Space orientation="vertical" size={24} style={{ width: '100%' }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="手機">
                <a href={`tel:${selected.phone.replace(/[^\d+]/g, '')}`}>{selected.phone}</a>
              </Descriptions.Item>
              <Descriptions.Item label="LINE ID">{selected.line_id ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="想體驗">{selected.interest ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="方便時段">{selected.preferred_slot ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="留言">{selected.message ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="送出時間">{formatServerTime(selected.created_at)}</Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Title level={5}>狀態</Typography.Title>
              {selected.status === '已成為會員' ? (
                <Typography.Text type="secondary">已建立會員帳號，可到會員管理查看。</Typography.Text>
              ) : (
                <Segmented<InquiryStatus>
                  value={selected.status}
                  onChange={(status) => statusMutation.mutate({ id: selected.id, status })}
                  options={INQUIRY_STATUSES.filter((s) => s !== '已成為會員')}
                />
              )}
            </div>

            <div>
              <Typography.Title level={5}>跟進紀錄</Typography.Title>
              {selected.notes.length ? (
                <Timeline
                  items={selected.notes.map((n) => ({
                    content: (
                      <div>
                        <div>{n.text}</div>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {formatServerTime(n.created_at)}・{n.created_by_name}
                        </Typography.Text>
                      </div>
                    ),
                  }))}
                />
              ) : (
                <Typography.Paragraph type="secondary">還沒有跟進紀錄。</Typography.Paragraph>
              )}
              <Input.TextArea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                autoSize={{ minRows: 2, maxRows: 5 }}
                placeholder="例如：已電話聯絡，約週六 10:00 體驗"
                aria-label="新增跟進紀錄"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {selected.status === '新詢問' ? '新增紀錄後狀態會自動改為「聯絡中」' : ''}
                </Typography.Text>
                <Button
                  disabled={!note.trim()}
                  loading={noteMutation.isPending}
                  onClick={() => noteMutation.mutate({ id: selected.id, text: note.trim() })}
                >
                  新增紀錄
                </Button>
              </div>
            </div>

            {selected.member_user_id === null && (
              <div>
                <Button type="primary" block onClick={() => openConvert(selected)}>
                  建立會員帳號
                </Button>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                  預設以手機號碼當帳號；之後可在「購買紀錄登錄」幫他登錄方案。
                </Typography.Paragraph>
              </div>
            )}
          </Space>
        )}
      </Drawer>

      <Modal
        open={convertOpen}
        title="建立會員帳號"
        okText="建立"
        cancelText="取消"
        confirmLoading={convertMutation.isPending}
        onCancel={() => setConvertOpen(false)}
        onOk={async () => {
          if (!selected) return;
          const values = await convertForm.validateFields();
          convertMutation.mutate({
            id: selected.id,
            values: { ...values, username: values.username.trim(), coupon_id: values.coupon_id ?? null },
          });
        }}
        destroyOnHidden
      >
        <Form form={convertForm} name="convert-inquiry" layout="vertical" requiredMark={false}>
          <Form.Item name="username" label="帳號" rules={[{ required: true, whitespace: true, message: '請輸入帳號' }]}>
            <Input maxLength={100} autoComplete="off" />
          </Form.Item>
          <Form.Item label="密碼" required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="password"
                noStyle
                rules={[
                  { required: true, message: '請輸入密碼' },
                  { min: MIN_PASSWORD_LENGTH, message: `密碼至少 ${MIN_PASSWORD_LENGTH} 個字元` },
                ]}
              >
                <Input autoComplete="new-password" />
              </Form.Item>
              <Button onClick={() => convertForm.setFieldValue('password', generatePassword())}>重新產生</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="must_change_password" valuePropName="checked">
            <Checkbox>第一次登入時必須自行修改密碼（建議）</Checkbox>
          </Form.Item>
          <Form.Item
            name="coupon_id"
            label="同時送體驗券"
            style={{ marginBottom: 0 }}
            extra={trialCoupons.length ? '會出現在會員的「我的優惠券」' : '還沒有啟用中的體驗券，可到「優惠券」建立'}
          >
            <Select
              allowClear
              placeholder="不送"
              options={trialCoupons.map((c) => ({ value: c.id, label: `${c.name}（${c.summary}）` }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

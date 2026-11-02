import { App, Button, Popconfirm, Space, Upload } from 'antd';
import { PaperClipOutlined, UploadOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteReceipt, fetchReceipt, uploadReceipt, type AccountingEntry } from '../../../../api/accounting';
import { apiErrorMessage } from '../../../../api/errors';

export interface ReceiptActionsProps {
  entry: AccountingEntry;
  /** 已刪除或該月已關帳：只能看，不能換或移除 */
  locked: boolean;
}

const ACCEPT = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf';
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * 帳目的收據（R64）：檔案不公開，用帶登入權杖的請求取回後在新分頁開啟；
 * 可上傳（jpg／png／pdf，5MB 內）、替換、移除。
 */
export function ReceiptActions({ entry, locked }: ReceiptActionsProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['accounting-entries'] });

  const upload = useMutation({
    mutationFn: (file: File) => uploadReceipt(entry.id, file),
    onSuccess: () => {
      message.success('已上傳收據');
      refresh();
    },
    onError: (error) => message.error(apiErrorMessage(error, '上傳失敗，請稍後再試')),
  });
  const remove = useMutation({
    mutationFn: () => deleteReceipt(entry.id),
    onSuccess: () => {
      message.success('已移除收據');
      refresh();
    },
    onError: (error) => message.error(apiErrorMessage(error, '移除失敗，請稍後再試')),
  });

  const view = async () => {
    // 先同步開分頁，避免取回檔案後才開被瀏覽器擋下
    const win = window.open('', '_blank');
    try {
      const blob = await fetchReceipt(entry.id);
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      win?.close();
      message.error(apiErrorMessage(error, '讀取收據失敗'));
    }
  };

  const picker = (label: string) => (
    <Upload
      accept={ACCEPT}
      showUploadList={false}
      beforeUpload={(file) => {
        if (file.size > MAX_BYTES) {
          message.error('收據檔案不能超過 5MB');
        } else {
          upload.mutate(file);
        }
        return false;
      }}
    >
      <Button type="link" size="small" icon={<UploadOutlined />} loading={upload.isPending}>
        {label}
      </Button>
    </Upload>
  );

  if (!entry.has_receipt) {
    return locked ? <span>—</span> : picker('上傳');
  }
  return (
    <Space size={0}>
      <Button type="link" size="small" icon={<PaperClipOutlined />} onClick={view}>
        查看
      </Button>
      {!locked && picker('換一張')}
      {!locked && (
        <Popconfirm title="移除這張收據？" onConfirm={() => remove.mutate()}>
          <Button type="link" size="small" danger loading={remove.isPending}>
            移除
          </Button>
        </Popconfirm>
      )}
    </Space>
  );
}

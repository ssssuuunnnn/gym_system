import { useState } from 'react';
import { App, Button, Space, Typography, Upload, theme } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { uploadWebsiteImage } from '../api/website';
import { apiErrorMessage } from '../api/errors';

const MAX_BYTES = 5 * 1024 * 1024;

export interface SiteImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  /** 建議尺寸等提示 */
  hint?: string;
  /** 預覽框高度 */
  height?: number;
}

/** 形象網站與最新消息共用的圖片上傳：jpg／png、5MB 以內，上傳後回填 /media 網址（存草稿時才會寫入網站內容）。 */
export function SiteImageUploader({ value, onChange, hint, height = 160 }: SiteImageUploaderProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [uploading, setUploading] = useState(false);

  const beforeUpload = async (file: File) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      message.error('僅支援 jpg、png 格式');
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_BYTES) {
      message.error('檔案超過 5MB，請壓縮後再上傳');
      return Upload.LIST_IGNORE;
    }
    setUploading(true);
    try {
      const { url } = await uploadWebsiteImage(file);
      onChange(url);
    } catch (err) {
      message.error(apiErrorMessage(err, '上傳失敗'));
    } finally {
      setUploading(false);
    }
    return Upload.LIST_IGNORE;
  };

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      {value ? (
        <img
          src={value}
          alt=""
          style={{ width: '100%', height, objectFit: 'cover', borderRadius: token.borderRadiusLG, background: token.colorFillTertiary }}
        />
      ) : (
        <div
          style={{
            height,
            borderRadius: token.borderRadiusLG,
            border: `1px dashed ${token.colorBorder}`,
            background: token.colorFillAlter,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: token.colorTextSecondary,
          }}
        >
          尚未上傳
        </div>
      )}
      <Space wrap>
        <Upload accept="image/jpeg,image/png" showUploadList={false} beforeUpload={beforeUpload}>
          <Button icon={<UploadOutlined />} loading={uploading}>
            {value ? '更換照片' : '上傳照片'}
          </Button>
        </Upload>
        {value && (
          <Button icon={<DeleteOutlined />} onClick={() => onChange(null)}>
            移除
          </Button>
        )}
      </Space>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        jpg、png，5MB 以內{hint ? `；${hint}` : ''}
      </Typography.Text>
    </Space>
  );
}

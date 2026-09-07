import { theme } from 'antd';
import { PictureOutlined } from '@ant-design/icons';

/** 88×50 課程封面縮圖；無圖時顯示 placeholder。團體課程列表／封存列表共用。 */
export function CourseCoverThumb({ url }: { url: string | null }) {
  const { token } = theme.useToken();
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={{ width: 88, height: 50, objectFit: 'cover', borderRadius: 6, display: 'block' }}
      />
    );
  }
  return (
    <div
      style={{
        width: 88,
        height: 50,
        borderRadius: 6,
        background: token.colorFillTertiary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: token.colorTextQuaternary,
      }}
    >
      <PictureOutlined style={{ fontSize: 18 }} />
    </div>
  );
}

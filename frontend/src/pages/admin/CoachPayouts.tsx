import { Card, Typography } from 'antd';

/**
 * 教練撥款
 * TODO: 實作撥款紀錄列表／撥款操作，並串接對應 API。目前僅供「教練費用結算」頁的
 * 「前往撥款」連結導向，避免連結失效。
 */
export default function CoachPayouts() {
  return (
    <Card>
      <Typography.Title level={4}>教練撥款</Typography.Title>
      <Typography.Paragraph type="secondary">
        此畫面尚待實作，欄位定義請參考專案文件「Wireframe 頁面清單」。
      </Typography.Paragraph>
    </Card>
  );
}

import { Card, Statistic } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';

interface StatCardProps {
  title: string;
  value: number | string;
  suffix?: string;
  prefix?: string;
  trend?: number;
}

/**
 * 儀表板頂部的統計卡片，對應設計稿 Statistic 元件規格：
 * trend 為正數顯示綠色上升箭頭，負數顯示紅色下降箭頭。
 */
export default function StatCard({ title, value, suffix, prefix, trend }: StatCardProps) {
  return (
    <Card>
      <Statistic title={title} value={value} prefix={prefix} suffix={suffix} />
      {trend !== undefined && (
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: trend > 0 ? '#52c41a' : '#ff4d4f',
          }}
        >
          {trend > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </Card>
  );
}

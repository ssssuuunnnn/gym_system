import { Card } from 'antd';

interface NewMemberTrendChartProps {
  data: Array<{ label: string; value: number }>;
}

/**
 * 近 7 日新增會員：以純 CSS flex 長條圖呈現，視覺節奏比照
 * CourseWeekdayChart／設計稿 DashboardContent.jsx 的長條圖作法。
 */
export default function NewMemberTrendChart({ data }: NewMemberTrendChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <Card title="近 7 日新增會員">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, marginTop: 12 }}>
        {data.map((d) => (
          <div
            key={d.label}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <div
              style={{
                width: '100%',
                height: `${(d.value / max) * 130}px`,
                background: '#1677ff',
                borderRadius: '4px 4px 0 0',
              }}
            />
            <span style={{ fontSize: 11, color: 'rgba(0, 0, 0, 0.45)' }}>{d.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

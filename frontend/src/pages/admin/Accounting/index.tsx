import { useState } from 'react';
import { Card, DatePicker, Space, Tabs, Typography } from 'antd';
import { BranchPicker } from '../../../components/BranchPicker';
import { useBranches } from '../../../lib/useBranches';
import { periodPresets, thisMonth, type Range } from './lib';
import { ReportTab } from './components/ReportTab';
import { EntriesTab } from './components/EntriesTab';
import { CategoriesTab } from './components/CategoriesTab';

type TabKey = 'report' | 'entries' | 'categories';

/**
 * 收支報表（ADR 0014、R57–R60）：現金制。
 * 收入＝已付款的方案銷售（依確認收款日），支出＝已撥款的人員費用（依撥款日），加上手動記帳。
 * 期間與分店篩選在上方，報表與手動記帳共用。
 */
export default function Accounting() {
  const [range, setRange] = useState<Range>(thisMonth);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [tab, setTab] = useState<TabKey>('report');
  const { branches, nameOf } = useBranches();
  const branchName = (id: number | null) => nameOf(id);

  return (
    <Card>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          收支報表
        </Typography.Title>
        {tab !== 'categories' && (
          <Space wrap>
            <DatePicker.RangePicker
              value={range}
              allowClear={false}
              presets={periodPresets()}
              onChange={(v) => v?.[0] && v[1] && setRange([v[0].startOf('day'), v[1].endOf('day')])}
            />
            <BranchPicker branches={branches} value={branchId} onChange={setBranchId} allowAll />
          </Space>
        )}
      </Space>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        以收到錢、付出錢的日期計算（現金制）：方案銷售依確認收款日，人員費用依撥款日；待付款與已結算未撥款的不計入。
      </Typography.Paragraph>

      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as TabKey)}
        items={[
          {
            key: 'report',
            label: '報表',
            children: <ReportTab range={range} branchId={branchId} branchName={branchName} />,
          },
          {
            key: 'entries',
            label: '手動記帳',
            children: <EntriesTab range={range} branchId={branchId} branches={branches} branchName={branchName} />,
          },
          { key: 'categories', label: '分類設定', children: <CategoriesTab /> },
        ]}
      />
    </Card>
  );
}

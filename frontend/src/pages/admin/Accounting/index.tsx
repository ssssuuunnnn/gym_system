import { useState } from 'react';
import { Card, DatePicker, Segmented, Space, Tabs, Typography } from 'antd';
import { BASIS_LABEL, type Basis } from '../../../api/accounting';
import { BranchPicker } from '../../../components/BranchPicker';
import { useBranches } from '../../../lib/useBranches';
import { useTerms, type Terms } from '../../../lib/terms';
import { periodPresets, thisMonth, type Range } from './lib';
import { ReportTab } from './components/ReportTab';
import { EntriesTab } from './components/EntriesTab';
import { DeferredTab } from './components/DeferredTab';
import { ClosesTab } from './components/ClosesTab';
import { CategoriesTab } from './components/CategoriesTab';

type TabKey = 'report' | 'entries' | 'deferred' | 'closes' | 'categories';

const BASIS_OPTIONS = (Object.keys(BASIS_LABEL) as Basis[]).map((b) => ({ value: b, label: BASIS_LABEL[b] }));

/** 計算方式說明（依行業用詞，R48） */
function basisNote(basis: Basis, t: Terms): string {
  if (basis === 'cash') {
    return '現金制：以收到錢、付出錢的日期計算；方案銷售依確認收款日，人員費用依撥款日，待付款與已結算未撥款的不計入。';
  }
  return `權責制：完成${t.service}才算收入（每${t.unit}價值＝實收 ÷ 購買${t.hours}，依${t.attend}日），${t.productSupply}依收款日；人員費用依已結算${t.staffPay}的${t.attend}日。`;
}

/**
 * 收支報表（ADR 0014、0015）：現金制／權責制報表、手動記帳與收據、預收款、關帳、分類設定。
 * 上方的期間用於報表與手動記帳，分店用於報表、手動記帳與預收款。
 */
export default function Accounting() {
  const [range, setRange] = useState<Range>(thisMonth);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [basis, setBasis] = useState<Basis>('cash');
  const [tab, setTab] = useState<TabKey>('report');
  const { branches, nameOf } = useBranches();
  const { t } = useTerms();
  const branchName = (id: number | null) => nameOf(id);

  const showRange = tab === 'report' || tab === 'entries';
  const showBranch = showRange || tab === 'deferred';

  return (
    <Card>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          收支報表
        </Typography.Title>
        <Space wrap>
          {tab === 'report' && <Segmented<Basis> value={basis} onChange={setBasis} options={BASIS_OPTIONS} />}
          {showRange && (
            <DatePicker.RangePicker
              value={range}
              allowClear={false}
              presets={periodPresets()}
              onChange={(v) => v?.[0] && v[1] && setRange([v[0].startOf('day'), v[1].endOf('day')])}
            />
          )}
          {showBranch && <BranchPicker branches={branches} value={branchId} onChange={setBranchId} allowAll />}
        </Space>
      </Space>
      {tab === 'report' && (
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          {basisNote(basis, t)}
        </Typography.Paragraph>
      )}

      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as TabKey)}
        items={[
          {
            key: 'report',
            label: '報表',
            children: <ReportTab range={range} branchId={branchId} branchName={branchName} basis={basis} />,
          },
          {
            key: 'entries',
            label: '手動記帳',
            children: <EntriesTab range={range} branchId={branchId} branches={branches} branchName={branchName} />,
          },
          { key: 'deferred', label: '預收款', children: <DeferredTab branchId={branchId} /> },
          { key: 'closes', label: '關帳', children: <ClosesTab /> },
          { key: 'categories', label: '分類設定', children: <CategoriesTab /> },
        ]}
      />
    </Card>
  );
}

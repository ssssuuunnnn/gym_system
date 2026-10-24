import { Form, Input, Select, Typography } from 'antd';
import { Link } from 'react-router-dom';
import type { SiteContent } from '../../../../../api/website';
import type { PanelProps } from '../../lib';

type Trial = SiteContent['trial'];

/** 預約體驗課表單：說明文字、選項、個資告知事項。送出的資料進到「詢問名單」。 */
export function TrialPanel({ value, onChange }: PanelProps<Trial>) {
  const set = (patch: Partial<Trial>) => onChange({ ...value, ...patch });
  return (
    <Form layout="vertical">
      <Typography.Paragraph type="secondary">
        訪客送出的資料會出現在<Link to="/admin/inquiries">詢問名單</Link>。表單固定詢問姓名、手機、LINE ID（選填）與留言。
      </Typography.Paragraph>
      <Form.Item htmlFor="site-trial-1" label="段落標題">
        <Input id="site-trial-1" value={value.title} maxLength={30} onChange={(e) => set({ title: e.target.value })} />
      </Form.Item>
      <Form.Item htmlFor="site-trial-2" label="說明">
        <Input.TextArea id="site-trial-2" value={value.intro} maxLength={200} showCount autoSize={{ minRows: 2, maxRows: 4 }} onChange={(e) => set({ intro: e.target.value })} />
      </Form.Item>
      <Form.Item htmlFor="site-trial-3" label="「想體驗」的選項" extra="輸入後按 Enter 新增，最多 8 個">
        <Select id="site-trial-3" mode="tags" value={value.interests} onChange={(interests: string[]) => set({ interests: interests.slice(0, 8) })} open={false} tokenSeparators={[',', '，']} />
      </Form.Item>
      <Form.Item htmlFor="site-trial-4" label="「方便的時段」選項" extra="輸入後按 Enter 新增，最多 8 個">
        <Select id="site-trial-4" mode="tags" value={value.slots} onChange={(slots: string[]) => set({ slots: slots.slice(0, 8) })} open={false} tokenSeparators={[',', '，']} />
      </Form.Item>
      <Form.Item htmlFor="site-trial-5" label="個人資料蒐集告知事項" extra="訪客必須勾選同意才能送出。依個人資料保護法，請載明蒐集目的、資料類別、利用期間與對象，以及當事人的權利。">
        <Input.TextArea id="site-trial-5" value={value.privacy_notice} maxLength={2000} showCount autoSize={{ minRows: 6, maxRows: 14 }} onChange={(e) => set({ privacy_notice: e.target.value })} />
      </Form.Item>
    </Form>
  );
}

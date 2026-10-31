import { Alert, Button, Form, Input, InputNumber } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listNews } from '../../../../../api/news';
import type { SiteContent } from '../../../../../api/website';
import type { PanelProps } from '../../lib';

type News = SiteContent['news'];

/** 最新消息段落：只設定標題與首頁顯示幾則；消息內容在後台「最新消息」新增與發布。 */
export function NewsPanel({ value, onChange }: PanelProps<News>) {
  const set = (patch: Partial<News>) => onChange({ ...value, ...patch });
  const { data: posts } = useQuery({ queryKey: ['news'], queryFn: listNews });
  const published = posts?.filter((p) => p.is_published).length ?? 0;
  return (
    <Form layout="vertical">
      <Alert
        type={published ? 'info' : 'warning'}
        showIcon
        style={{ marginBottom: 16 }}
        title={published ? `目前有 ${published} 則已發布的消息` : '還沒有已發布的消息，這個段落暫時不會出現在網站上'}
        description="消息在「最新消息」頁面新增、發布，也可以從那裡用 LINE 發給會員；發布後網站上馬上看得到，不用再按「發布到網站」。"
        action={
          <Link to="/admin/news">
            <Button size="small">前往最新消息</Button>
          </Link>
        }
      />
      <Form.Item htmlFor="site-news-1" label="段落標題">
        <Input id="site-news-1" value={value.title} maxLength={30} onChange={(e) => set({ title: e.target.value })} />
      </Form.Item>
      <Form.Item htmlFor="site-news-2" label="首頁顯示幾則" extra="其他的放在「看全部消息」頁面">
        <InputNumber id="site-news-2" min={1} max={12} value={value.count} onChange={(v) => set({ count: v ?? 3 })} />
      </Form.Item>
    </Form>
  );
}

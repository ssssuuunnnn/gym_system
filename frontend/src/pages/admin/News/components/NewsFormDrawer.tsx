import { useEffect } from 'react';
import { App, Button, Drawer, Flex, Form, Input, Switch, Typography } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createNews, updateNews, type NewsInput, type NewsPost } from '../../../../api/news';
import { apiErrorMessage } from '../../../../api/errors';
import { SiteImageUploader } from '../../../../components/SiteImageUploader';

export interface NewsFormDrawerProps {
  /** null＝關閉；'new'＝新增；NewsPost＝編輯這則 */
  editing: NewsPost | 'new' | null;
  onClose: () => void;
  /** 存好之後（新增的話帶回新的消息，可接著用 LINE 發送） */
  onSaved: (post: NewsPost, isNew: boolean) => void;
}

const EMPTY: NewsInput = { title: '', summary: '', body: '', image_url: null, is_published: true };

/** 新增／編輯最新消息：標題、摘要（列表與 LINE 卡片用）、內文、圖片、是否發布。 */
export function NewsFormDrawer({ editing, onClose, onSaved }: NewsFormDrawerProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<NewsInput>();
  const isNew = editing === 'new';
  const imageUrl = Form.useWatch('image_url', form) ?? null;

  useEffect(() => {
    if (editing === null) return;
    form.setFieldsValue(
      editing === 'new'
        ? EMPTY
        : {
            title: editing.title,
            summary: editing.summary,
            body: editing.body,
            image_url: editing.image_url,
            is_published: editing.is_published,
          },
    );
  }, [editing, form]);

  const saveMutation = useMutation({
    mutationFn: (values: NewsInput) =>
      editing && editing !== 'new' ? updateNews(editing.id, values) : createNews(values),
    onSuccess: (post) => {
      message.success(isNew ? '已新增消息' : '已儲存');
      queryClient.invalidateQueries({ queryKey: ['news'] });
      onSaved(post, isNew);
    },
    onError: (err) => message.error(apiErrorMessage(err)),
  });

  return (
    <Drawer
      open={editing !== null}
      title={isNew ? '新增消息' : '編輯消息'}
      size="large"
      onClose={onClose}
      destroyOnHidden
      extra={
        <Flex gap={8}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saveMutation.isPending} onClick={() => form.submit()}>
            儲存
          </Button>
        </Flex>
      }
    >
      <Form<NewsInput>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={EMPTY}
        onFinish={(values) => saveMutation.mutate({ ...values, image_url: values.image_url ?? null })}
      >
        <Form.Item label="標題" name="title" rules={[{ required: true, whitespace: true, message: '請輸入標題' }]}>
          <Input maxLength={80} showCount placeholder="例如：十一月公休公告、雙十一課程優惠" />
        </Form.Item>
        <Form.Item label="摘要" name="summary" extra="顯示在網站列表與 LINE 訊息卡片上，一兩句話說重點">
          <Input.TextArea maxLength={200} showCount autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>
        <Form.Item label="內文" name="body" extra="顯示在網站上的消息頁面；換行會保留">
          <Input.TextArea maxLength={5000} showCount autoSize={{ minRows: 8, maxRows: 20 }} />
        </Form.Item>
        <Form.Item label="圖片（選填）" name="image_url">
          <SiteImageUploader
            value={imageUrl}
            onChange={(url) => form.setFieldValue('image_url', url)}
            hint="建議橫式 1200×780；用 LINE 發送時也會放在卡片上"
          />
        </Form.Item>
        <Form.Item label="發布到網站" name="is_published" valuePropName="checked" extra="關閉＝存成草稿，網站上看不到">
          <Switch checkedChildren="發布" unCheckedChildren="草稿" />
        </Form.Item>
        <Typography.Text type="secondary">
          發布後馬上出現在形象網站的「最新消息」（網站本身要已經發布）。要通知會員，存好之後按「用 LINE 發送」。
        </Typography.Text>
      </Form>
    </Drawer>
  );
}

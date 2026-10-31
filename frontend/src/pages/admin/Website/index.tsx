import { useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Col, Popconfirm, Row, Skeleton, Space, Tag, Typography } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  discardWebsiteDraft,
  getWebsite,
  publishWebsite,
  saveWebsiteDraft,
  SECTION_LABEL,
  unpublishWebsite,
  type SiteContent,
  type WebsiteState,
} from '../../../api/website';
import { apiErrorMessage } from '../../../api/errors';
import { formatServerTime } from '../../../lib/datetime';
import { usePageActionBar } from '../../../store/pageActionBar';
import { SectionNav, type EditorTarget } from './components/SectionNav';
import { PreviewPane } from './components/PreviewPane';
import { SettingsPanel } from './components/panels/SettingsPanel';
import { HeroPanel } from './components/panels/HeroPanel';
import { AboutPanel } from './components/panels/AboutPanel';
import { SchedulePanel } from './components/panels/SchedulePanel';
import { CoachesPanel } from './components/panels/CoachesPanel';
import { PricingPanel } from './components/panels/PricingPanel';
import { GalleryPanel } from './components/panels/GalleryPanel';
import { FaqPanel } from './components/panels/FaqPanel';
import { TrialPanel } from './components/panels/TrialPanel';
import { ContactPanel } from './components/panels/ContactPanel';
import { SocialPanel } from './components/panels/SocialPanel';
import { NewsPanel } from './components/panels/NewsPanel';

/** 段落在網站上的 id（預覽時捲到正在編輯的段落） */
// 社群連結顯示在「交通與聯絡」段落（和頁尾），預覽捲到那裡
const SECTION_ANCHOR: Partial<Record<EditorTarget, string>> = { hero: 'top', social: 'contact' };

/** 送出前略過沒填完的清單項目（空白的常見問題、特色） */
function sanitize(content: SiteContent): SiteContent {
  return {
    ...content,
    about: { ...content.about, features: content.about.features.filter((f) => f.title.trim()) },
    faq: { ...content.faq, items: content.faq.items.filter((i) => i.q.trim() && i.a.trim()) },
  };
}

/**
 * 形象網站編輯（見 docs/adr/0003-gym-website.md）：
 * 左側段落清單（顯示／順序）、中間段落設定、右側伺服器產生的草稿預覽；底部儲存草稿／發布。
 */
export default function Website() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { data: state, isLoading } = useQuery({ queryKey: ['website'], queryFn: getWebsite });
  const [content, setContent] = useState<SiteContent | null>(null);
  const [current, setCurrent] = useState<EditorTarget>('settings');
  const [previewVersion, setPreviewVersion] = useState(0);

  useEffect(() => {
    if (state && content === null) setContent(state.draft);
  }, [state, content]);

  const dirty = useMemo(
    () => !!state && !!content && JSON.stringify(content) !== JSON.stringify(state.draft),
    [state, content],
  );

  const applyState = (next: WebsiteState) => {
    queryClient.setQueryData(['website'], next);
    setContent(next.draft);
    setPreviewVersion((v) => v + 1);
  };

  const onError = (err: unknown) => message.error(apiErrorMessage(err, '儲存失敗'));
  const saveMutation = useMutation({
    mutationFn: (c: SiteContent) => saveWebsiteDraft(sanitize(c)),
    onSuccess: (next) => {
      applyState(next);
      message.success('草稿已儲存');
    },
    onError,
  });
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (dirty && content) await saveWebsiteDraft(sanitize(content));
      return publishWebsite();
    },
    onSuccess: (next) => {
      applyState(next);
      message.success('已發布到網站');
    },
    onError: (err) => message.error(apiErrorMessage(err, '發布失敗')),
  });
  const discardMutation = useMutation({
    mutationFn: discardWebsiteDraft,
    onSuccess: (next) => {
      applyState(next);
      message.success('已捨棄草稿');
    },
    onError,
  });
  const unpublishMutation = useMutation({
    mutationFn: unpublishWebsite,
    onSuccess: (next) => {
      applyState(next);
      message.success('網站已下線，首頁改回登入頁');
    },
    onError,
  });

  const busy = saveMutation.isPending || publishMutation.isPending || discardMutation.isPending;
  const hasDraftChanges = dirty || !!state?.has_unpublished_changes || !state?.is_published;

  usePageActionBar(
    content ? (
      <Space wrap>
        {dirty && <Typography.Text type="warning">有尚未儲存的修改</Typography.Text>}
        <Popconfirm
          title="捨棄草稿？"
          description={state?.is_published ? '回到目前網站上的內容。' : '回到預設內容。'}
          okText="捨棄"
          cancelText="取消"
          onConfirm={() => discardMutation.mutateAsync()}
          disabled={!hasDraftChanges}
        >
          <Button disabled={!hasDraftChanges || busy}>捨棄草稿</Button>
        </Popconfirm>
        <Button disabled={!dirty || busy} loading={saveMutation.isPending} onClick={() => saveMutation.mutate(content)}>
          儲存草稿
        </Button>
        <Popconfirm
          title="發布到網站？"
          description="訪客會立即看到目前的內容。"
          okText="發布"
          cancelText="取消"
          onConfirm={() => publishMutation.mutateAsync()}
        >
          <Button type="primary" loading={publishMutation.isPending} disabled={busy || !hasDraftChanges}>
            發布到網站
          </Button>
        </Popconfirm>
      </Space>
    ) : null,
  );

  if (isLoading || !state || !content) {
    return <Skeleton active />;
  }

  const patch = (p: Partial<SiteContent>) => setContent({ ...content, ...p });
  const siteUrl = `${window.location.origin}/`;

  const panel = (() => {
    switch (current) {
      case 'settings':
        return <SettingsPanel content={content} onChange={patch} />;
      case 'social':
        return <SocialPanel value={content.contact} onChange={(contact) => patch({ contact })} />;
      case 'hero':
        return <HeroPanel value={content.hero} onChange={(hero) => patch({ hero })} />;
      case 'about':
        return <AboutPanel value={content.about} onChange={(about) => patch({ about })} />;
      case 'news':
        return <NewsPanel value={content.news} onChange={(news) => patch({ news })} />;
      case 'schedule':
        return <SchedulePanel value={content.schedule} onChange={(schedule) => patch({ schedule })} />;
      case 'coaches':
        return <CoachesPanel value={content.coaches} onChange={(coaches) => patch({ coaches })} />;
      case 'pricing':
        return <PricingPanel value={content.pricing} onChange={(pricing) => patch({ pricing })} />;
      case 'gallery':
        return <GalleryPanel value={content.gallery} onChange={(gallery) => patch({ gallery })} />;
      case 'faq':
        return <FaqPanel value={content.faq} onChange={(faq) => patch({ faq })} />;
      case 'trial':
        return <TrialPanel value={content.trial} onChange={(trial) => patch({ trial })} />;
      case 'contact':
        return <ContactPanel value={content.contact} onChange={(contact) => patch({ contact })} />;
    }
  })();

  const statusTag = !state.is_published ? (
    <Tag>尚未上線</Tag>
  ) : state.has_unpublished_changes || dirty ? (
    <Tag color="orange">有未發布的變更</Tag>
  ) : (
    <Tag color="green">已發布</Tag>
  );

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Space wrap size={12}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            形象網站
          </Typography.Title>
          {statusTag}
          <Typography.Text type="secondary">
            {state.published_at
              ? `上次發布 ${formatServerTime(state.published_at)}・${state.published_by_name ?? ''}`
              : '還沒有發布過'}
          </Typography.Text>
        </Space>
        <Space wrap>
          {state.is_published && (
            <>
              <Typography.Link href={siteUrl} target="_blank">
                {siteUrl} <ExportOutlined />
              </Typography.Link>
              <Popconfirm
                title="讓網站下線？"
                description="首頁會改回登入頁，草稿保留，之後可以再發布。"
                okText="下線"
                okButtonProps={{ danger: true }}
                cancelText="取消"
                onConfirm={() => unpublishMutation.mutateAsync()}
              >
                <Button danger size="small">
                  下線
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      </div>

      {!state.is_published && (
        <Alert
          type="info"
          showIcon
          title="網站還沒上線"
          description="目前首頁會直接顯示登入頁。編輯完成後按「發布到網站」，首頁就會變成形象網站，會員登入改由網站右上角進入。"
        />
      )}

      <Row gutter={[16, 16]} align="top">
        <Col xs={24} lg={6} xl={5}>
          <Card size="small" styles={{ body: { padding: 8 } }}>
            <SectionNav
              sections={content.sections}
              current={current}
              onSelect={setCurrent}
              onChange={(sections) => patch({ sections })}
            />
          </Card>
        </Col>
        <Col xs={24} lg={18} xl={11}>
          <Card title={current === 'settings' ? '網站設定' : current === 'social' ? '社群連結' : SECTION_LABEL[current]}>{panel}</Card>
        </Col>
        <Col xs={24} xl={8}>
          <PreviewPane
            version={previewVersion}
            anchor={current === 'settings' ? undefined : (SECTION_ANCHOR[current] ?? current)}
          />
        </Col>
      </Row>
    </Space>
  );
}

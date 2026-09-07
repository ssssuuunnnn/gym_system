import { useEffect, useMemo, useState } from 'react';
import { Breadcrumb, Button, Card, Modal, Skeleton, Space, Typography, message } from 'antd';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import {
  archiveCourse,
  createCourse,
  getCourse,
  updateCourse,
  uploadCourseCover,
  type CourseStatus,
  type CoursePayload,
} from '../../../api/courses';
import { listCoaches } from '../../../api/coaches';
import { usePageActionBar } from '../../../store/pageActionBar';
import { CourseInfoCard, type CourseInfoValue } from './components/CourseInfoCard';
import { CourseStatusCard } from './components/CourseStatusCard';
import { ScheduleRulesEditor } from './components/ScheduleRulesEditor';
import { SchedulePreviewCalendar } from './components/SchedulePreviewCalendar';
import { SessionsTable } from './components/SessionsTable';
import {
  emptyScheduleState,
  expand,
  fromDetail,
  initialCreateState,
  makeRule,
  ruleSummary,
  toRulePayload,
  toSessionPayload,
  type EngineState,
  type RuleState,
} from './lib/recurrence';

type Mode = 'new' | 'edit' | 'duplicate';

const COVER_MAX_BYTES = 2 * 1024 * 1024;
const COVER_TYPES = ['image/jpeg', 'image/png'];

export default function CourseForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const courseId = id ? Number(id) : undefined;
  const mode: Mode = courseId == null ? 'new' : location.pathname.endsWith('/duplicate') ? 'duplicate' : 'edit';

  const { data: detail, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => getCourse(courseId as number),
    enabled: courseId != null,
  });
  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const coachOptions = useMemo(
    () => (coaches ?? []).map((c) => ({ value: c.id, label: c.name })),
    [coaches],
  );

  const [info, setInfo] = useState<CourseInfoValue>({
    name: '',
    coachId: null,
    minCapacity: null,
    maxCapacity: null,
    description: '',
    durationMinutes: 60,
  });
  const [status, setStatus] = useState<CourseStatus>('上架');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [anchor, setAnchor] = useState<Dayjs>(() => dayjs());
  const [engine, setEngine] = useState<EngineState>(() =>
    initialCreateState(),
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  // 僅在載入到（或切換至）另一門課時帶入表單，避免背景重新整理蓋掉使用者編輯
  useEffect(() => {
    if (!detail) return;
    setInfo({
      name: mode === 'duplicate' ? `${detail.name}（複製）` : detail.name,
      coachId: detail.coach_id,
      minCapacity: detail.min_capacity,
      maxCapacity: detail.max_capacity,
      description: detail.description ?? '',
      durationMinutes: detail.duration_minutes,
    });
    setStatus(mode === 'duplicate' ? '下架' : detail.status);
    setCoverUrl(mode === 'duplicate' ? null : detail.cover_image_url);
    setCoverFile(null);
    setCoverPreview(null);
    setEngine(mode === 'duplicate' ? emptyScheduleState() : fromDetail(detail));
    setEditingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id, mode]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const occurrences = useMemo(() => expand(engine), [engine]);

  const patchInfo = (patch: Partial<CourseInfoValue>) => setInfo((p) => ({ ...p, ...patch }));

  const patchRule = (ruleId: string, patch: Partial<RuleState>) =>
    setEngine((s) => ({ ...s, rules: s.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)) }));

  const removeRule = (ruleId: string) =>
    setEngine((s) => {
      const overrides = Object.fromEntries(
        Object.entries(s.overrides).filter(([k]) => !k.startsWith(`${ruleId}:`)),
      );
      const removed = Object.fromEntries(
        Object.entries(s.removed).filter(([k]) => !k.startsWith(`${ruleId}:`)),
      );
      return {
        ...s,
        overrides,
        removed,
        rules: s.rules.filter((r) => r.id !== ruleId).map((r, i) => ({ ...r, position: i })),
      };
    });

  const addRule = () =>
    setEngine((s) => ({
      ...s,
      seq: s.seq + 1,
      rules: [...s.rules, makeRule(s.rules.length, `r_${s.seq}`)],
    }));

  const addExtra = (dateKey: string, minute: number) =>
    setEngine((s) => ({
      ...s,
      seq: s.seq + 1,
      extras: [...s.extras, { id: `x_${s.seq}`, dateKey, minute }],
    }));

  const removeOcc = (occId: string) =>
    setEngine((s) => {
      if (s.extras.some((e) => e.id === occId)) {
        return { ...s, extras: s.extras.filter((e) => e.id !== occId) };
      }
      return { ...s, removed: { ...s.removed, [occId]: true } };
    });

  const setOverride = (occId: string, dateKey: string, minute: number) =>
    setEngine((s) => {
      if (s.extras.some((e) => e.id === occId)) {
        return {
          ...s,
          extras: s.extras.map((e) => (e.id === occId ? { ...e, dateKey, minute } : e)),
        };
      }
      return { ...s, overrides: { ...s.overrides, [occId]: { dateKey, minute } } };
    });

  const resetOcc = (occId: string) =>
    setEngine((s) => {
      const overrides = { ...s.overrides };
      delete overrides[occId];
      return { ...s, overrides };
    });

  const changeOccDate = (occId: string, dateKey: string) => {
    const occ = occurrences.find((o) => o.occId === occId);
    if (occ) setOverride(occId, dateKey, occ.minute);
  };
  const changeOccTime = (occId: string, minute: number) => {
    const occ = occurrences.find((o) => o.occId === occId);
    if (occ) setOverride(occId, occ.dateKey, minute);
  };

  const clearAll = () => {
    setEngine((s) => ({ ...s, rules: [], overrides: {}, removed: {}, extras: [] }));
    setEditingId(null);
  };

  const pickCover = (file: File) => {
    if (!COVER_TYPES.includes(file.type)) {
      message.error('僅支援 jpg、png 格式');
      return;
    }
    if (file.size > COVER_MAX_BYTES) {
      message.error('檔案超過 2MB，請壓縮後再上傳');
      return;
    }
    setCoverFile(file);
  };
  const removeCover = () => {
    setCoverFile(null);
    setCoverUrl(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let cover = coverUrl;
      if (coverFile) cover = await uploadCourseCover(coverFile);
      const payload: CoursePayload = {
        name: info.name.trim(),
        coach_id: info.coachId as number,
        duration_minutes: info.durationMinutes,
        min_capacity: info.minCapacity as number,
        max_capacity: info.maxCapacity as number,
        description: info.description.trim() || null,
        cover_image_url: cover,
        status,
        rules: toRulePayload(engine.rules),
        sessions: toSessionPayload(occurrences, info.durationMinutes),
      };
      return mode === 'edit'
        ? updateCourse(courseId as number, payload)
        : createCourse(payload);
    },
    onSuccess: (saved) => {
      message.success(mode === 'edit' ? '已更新團體課程' : '已建立團體課程');
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course', saved.id] });
      navigate('/admin/courses');
    },
    onError: (error) => {
      const apiDetail = isAxiosError<{ detail?: string }>(error)
        ? error.response?.data?.detail
        : undefined;
      message.error(apiDetail || '儲存失敗，請稍後再試');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveCourse(courseId as number),
    onSuccess: () => {
      message.success('已封存課程');
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      navigate('/admin/courses');
    },
    onError: () => message.error('封存失敗，請稍後再試'),
  });

  const submit = () => {
    if (!info.name.trim()) return message.error('請輸入課程名稱');
    if (info.coachId == null) return message.error('請選擇教練');
    if (info.minCapacity == null || info.maxCapacity == null) return message.error('請填寫開班人數');
    if (info.maxCapacity < info.minCapacity) return message.error('報名上限不可小於最低開班人數');
    saveMutation.mutate();
  };

  const confirmArchive = () => {
    Modal.confirm({
      title: `確定要封存「${detail?.name}」？`,
      content: '封存後課程會移出課程列表，可於「封存課程」頁還原。',
      okText: '封存',
      cancelText: '取消',
      onOk: () => archiveMutation.mutateAsync(),
    });
  };

  usePageActionBar(
    <Space>
      {mode === 'edit' && (
        <>
          <Button onClick={confirmArchive} loading={archiveMutation.isPending}>
            封存
          </Button>
          <Button onClick={() => navigate(`/admin/courses/${courseId}/duplicate`)}>複製</Button>
          <span
            style={{ display: 'inline-block', width: 1, height: 20, background: 'rgba(0,0,0,0.1)' }}
          />
        </>
      )}
      <Button onClick={() => navigate('/admin/courses')}>取消</Button>
      <Button type="primary" onClick={submit} loading={saveMutation.isPending}>
        確定
      </Button>
    </Space>,
  );

  const crumbLast = mode === 'new' ? '新增課程' : mode === 'duplicate' ? '複製課程' : '編輯課程';
  const title = mode === 'new' ? '新增團體課程' : mode === 'duplicate' ? '複製團體課程' : '編輯團體課程';
  const subtitle =
    mode === 'new'
      ? '建立後可於課程排程日曆檢視與調整'
      : mode === 'duplicate'
        ? `複製自「${detail?.name ?? ''}」，開課時間需重新設定`
        : detail
          ? `最後編輯 ${dayjs(detail.updated_at).format('YYYY-MM-DD HH:mm')}・編輯者 ${detail.updated_by_name ?? '—'}`
          : '';

  if (courseId != null && isLoading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Breadcrumb items={[{ title: '課程管理' }, { title: '團體課程' }, { title: crumbLast }]} />

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 13, paddingBottom: 2 }}>
          {subtitle}
        </Typography.Text>
      </div>

      <CourseInfoCard
        value={info}
        onChange={patchInfo}
        coachOptions={coachOptions}
        coverPreview={coverPreview ?? coverUrl}
        coverHint={coverFile ? `${coverFile.name}・儲存後套用` : ''}
        onPickCover={pickCover}
        onRemoveCover={removeCover}
      />

      <Card title="課程時段">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ScheduleRulesEditor
            rules={engine.rules}
            onPatchRule={patchRule}
            onRemoveRule={removeRule}
            onAddRule={addRule}
            summaryFor={(rule) => ruleSummary(engine, rule)}
          />
          <SchedulePreviewCalendar
            anchor={anchor}
            onAnchorChange={setAnchor}
            occurrences={occurrences}
            courseName={info.name}
            durationMinutes={info.durationMinutes}
            onAddExtra={addExtra}
            onRemoveOcc={removeOcc}
          />
          <SessionsTable
            occurrences={occurrences}
            durationMinutes={info.durationMinutes}
            editingId={editingId}
            onStartEdit={setEditingId}
            onDoneEdit={() => setEditingId(null)}
            onChangeDate={changeOccDate}
            onChangeTime={changeOccTime}
            onResetOcc={resetOcc}
            onRemoveOcc={removeOcc}
            onClearAll={clearAll}
          />
        </div>
      </Card>

      <CourseStatusCard value={status} onChange={setStatus} />
    </Space>
  );
}

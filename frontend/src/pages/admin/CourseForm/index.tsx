import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Breadcrumb, Button, Card, Modal, Skeleton, Space, Typography, message } from 'antd';
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
import { listTimeSlots } from '../../../api/timeSlots';
import { buildOverrideMap } from '../../../lib/availability';
import { usePageActionBar } from '../../../store/pageActionBar';
import { CourseInfoCard, type CourseInfoValue } from './components/CourseInfoCard';
import { CourseStatusCard } from './components/CourseStatusCard';
import { ScheduleSpecForm } from './components/ScheduleSpecForm';
import { SchedulePreviewCalendar } from './components/SchedulePreviewCalendar';
import { SessionsTable } from './components/SessionsTable';
import {
  cancelledFromDetail,
  confirmedFromDetail,
  emptyScheduleSpec,
  expandSchedule,
  extrasFromDetail,
  scheduleSummary,
  specFromDetail,
  toSessionPayload,
  type ExtraSession,
  type ScheduleSpec,
} from './lib/recurrence';
import { formatServerTime } from '../../../lib/datetime';

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
  // 團體課程只能指定「團體課程教練」；編輯時保留目前綁定的教練（即使類型後來改了）
  const coachOptions = useMemo(
    () =>
      (coaches ?? [])
        .filter((c) => c.coach_types.includes('團體課程教練') || (mode === 'edit' && c.id === detail?.coach_id))
        .map((c) => ({ value: c.id, label: c.name })),
    [coaches, mode, detail?.coach_id],
  );

  // time_slots 是時段可用性的唯一真相來源：公休時段不可開課。
  const { data: slots } = useQuery({ queryKey: ['time-slots'], queryFn: listTimeSlots });
  const closedMap = useMemo(() => buildOverrideMap(slots), [slots]);
  const isSlotClosed = useCallback(
    (dateKey: string, minute: number) =>
      closedMap.get(`${dateKey}-${Math.floor(minute / 60)}`) === false,
    [closedMap],
  );

  // 上架中、且仍有未過期未停課課堂的團體課程：編輯時整個「課程時段」鎖定，不可異動。
  const scheduleLocked =
    mode === 'edit' &&
    detail?.status === '上架' &&
    (detail?.sessions ?? []).some(
      (s) => !s.is_cancelled && s.session_date >= dayjs().format('YYYY-MM-DD'),
    );

  const [info, setInfo] = useState<CourseInfoValue>({
    name: '',
    coachId: null,
    minCapacity: null,
    maxCapacity: null,
    description: '',
    durationMinutes: 60,
    coachFee: 0,
  });
  const [status, setStatus] = useState<CourseStatus>('上架');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [anchor, setAnchor] = useState<Dayjs>(() => dayjs());
  const [spec, setSpec] = useState<ScheduleSpec>(() => emptyScheduleSpec());
  const [cancelled, setCancelled] = useState<Set<string>>(() => new Set());
  const [confirmed, setConfirmed] = useState<Set<string>>(() => new Set());
  const [extras, setExtras] = useState<ExtraSession[]>([]);

  // 僅在載入到（或切換至）另一門課時帶入表單，避免背景重新整理蓋掉使用者編輯
  useEffect(() => {
    if (!detail) return;
    const dup = mode === 'duplicate';
    setInfo({
      name: dup ? `${detail.name}（複製）` : detail.name,
      coachId: detail.coach_id,
      minCapacity: detail.min_capacity,
      maxCapacity: detail.max_capacity,
      description: detail.description ?? '',
      durationMinutes: detail.duration_minutes,
      coachFee: detail.coach_fee ?? 0,
    });
    setStatus(dup ? '下架' : detail.status);
    setCoverUrl(dup ? null : detail.cover_image_url);
    setCoverFile(null);
    setCoverPreview(null);
    setSpec(dup ? emptyScheduleSpec() : specFromDetail(detail));
    setCancelled(dup ? new Set() : cancelledFromDetail(detail));
    setConfirmed(dup ? new Set() : confirmedFromDetail(detail));
    setExtras(dup ? [] : extrasFromDetail(detail));
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

  // 落在公休的排程課堂標「時段公休」（不計堂數、儲存略過）；編輯時已儲存的正常課堂 (confirmed) 不受影響
  const sessions = useMemo(
    () => expandSchedule(spec, cancelled, extras, isSlotClosed, confirmed),
    [spec, cancelled, extras, isSlotClosed, confirmed],
  );
  const activeCount = sessions.filter((s) => !s.isCancelled && !s.closedSlot).length;
  const closedCount = sessions.filter((s) => s.closedSlot).length;
  const summary = scheduleSummary(spec, activeCount, closedCount);

  const patchInfo = (patch: Partial<CourseInfoValue>) => setInfo((p) => ({ ...p, ...patch }));
  const patchSpec = (patch: Partial<ScheduleSpec>) => setSpec((s) => ({ ...s, ...patch }));

  const toggleCancel = (dateKey: string) =>
    setCancelled((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });

  const addExtra = (dateKey: string, minute: number) =>
    setExtras((prev) => {
      const key = `x-${dateKey}-${minute}`;
      if (prev.some((e) => e.key === key)) return prev;
      return [...prev, { key, dateKey, minute }];
    });
  const removeExtra = (key: string) => setExtras((prev) => prev.filter((e) => e.key !== key));

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
        coach_fee: info.coachFee ?? 0,
        description: info.description.trim() || null,
        cover_image_url: cover,
        status,
        weekdays: spec.weekdays,
        start_hour: Math.floor(spec.startMinute / 60),
        start_date: spec.startDate || null,
        end_mode: spec.endMode,
        end_date: spec.endMode === '結束日' ? spec.endDate || null : null,
        week_count: spec.endMode === '週數' ? spec.weekCount : null,
        sessions: toSessionPayload(sessions, info.durationMinutes),
      };
      return mode === 'edit' ? updateCourse(courseId as number, payload) : createCourse(payload);
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
    if (info.coachFee == null) return message.error('請填寫每堂教練費（不支薪請填 0）');
    if (info.minCapacity == null || info.maxCapacity == null) return message.error('請填寫開班人數');
    if (info.maxCapacity < info.minCapacity) return message.error('每堂人數上限不可小於最低開班人數');
    if (status !== '草稿') {
      if (spec.weekdays.length === 0) return message.error('請選擇上課星期');
      if (!spec.startDate) return message.error('請設定開課起日');
      if (spec.endMode === '結束日' && !spec.endDate) return message.error('請設定開課結束日');
      if (activeCount === 0) {
        return message.error(
          closedCount > 0
            ? '所選星期／時段皆為公休，請調整星期／時間，或先於「公休設定」開放這些時段'
            : '目前排程沒有任何課堂，請調整星期或開課期間',
        );
      }
    }
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
      ? '設定上課星期、時間與開課期間，系統會展開出所有課堂'
      : mode === 'duplicate'
        ? `複製自「${detail?.name ?? ''}」，開課時間需重新設定`
        : detail
          ? `最後編輯 ${formatServerTime(detail.updated_at)}・編輯者 ${detail.updated_by_name ?? '—'}`
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
          {scheduleLocked && (
            <Alert
              type="warning"
              showIcon
              message="此課程已上架，開課時段不可異動"
              description="如需調整星期／期間、停課或加開，請先於下方將課程狀態改為下架或草稿並儲存。"
            />
          )}
          <ScheduleSpecForm
            value={spec}
            onChange={patchSpec}
            summary={summary}
            readOnly={scheduleLocked}
          />
          <SchedulePreviewCalendar
            anchor={anchor}
            onAnchorChange={setAnchor}
            sessions={sessions}
            courseName={info.name}
            durationMinutes={info.durationMinutes}
            isSlotClosed={isSlotClosed}
          />
          <SessionsTable
            sessions={sessions}
            durationMinutes={info.durationMinutes}
            isSlotClosed={isSlotClosed}
            onToggleCancel={toggleCancel}
            onRemoveExtra={removeExtra}
            onAddExtra={addExtra}
            readOnly={scheduleLocked}
          />
        </div>
      </Card>

      <CourseStatusCard value={status} onChange={setStatus} />
    </Space>
  );
}

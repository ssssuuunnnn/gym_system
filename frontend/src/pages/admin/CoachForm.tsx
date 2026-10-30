import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Breadcrumb, Button, Card, Checkbox, Input, InputNumber, Modal, Result, Skeleton, Tag, message, theme } from 'antd';
import { ExclamationCircleFilled, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  createCoach,
  deleteCoach,
  listCoaches,
  updateCoach,
  uploadCoachPhoto,
  COACH_TYPES,
  type CoachPayload,
  type CoachType,
} from '../../api/coaches';
import { listMembers } from '../../api/users';
import { useBranches } from '../../lib/useBranches';
import { formatServerTime } from '../../lib/datetime';
import { coachTypeLabel, useTerms } from '../../lib/terms';

// 電話格式：數字、+、-、括號、空白，至少 8 碼（與教練資料設計稿一致）
const PHONE_RE = /^[0-9+\-() ]{8,}$/;

/**
 * 場租教練不屬於公司，不能與私人教練／團體課程教練並存（後端同樣檢查）：
 * 新勾場租 → 只留場租；場租狀態下勾其他類型 → 拿掉場租。
 */
function normalizeCoachTypes(prev: CoachType[], next: CoachType[]): CoachType[] {
  const addedRental = next.includes('場租教練') && !prev.includes('場租教練');
  if (addedRental) return ['場租教練'];
  if (next.includes('場租教練') && next.length > 1) return next.filter((t) => t !== '場租教練');
  // 依固定順序排列，方便與既有資料比較是否有變更
  return COACH_TYPES.filter((t) => next.includes(t));
}

const fmtDate = (value: string) => formatServerTime(value, 'YYYY-MM-DD');
const fmtDateTime = (value: string) => formatServerTime(value);

/**
 * 新增／編輯教練資料：對應「教練管理 → 教練資料列表 → 新增教練／編輯教練資料」。
 * 新增：綁定帳號以關鍵字搜尋既有會員（已綁定者不可選）。
 * 編輯：綁定帳號唯讀（如需換綁須刪除本筆重建），底部提供刪除教練資料。
 * 後端無 GET /coaches/{id}，編輯模式從既有列表快取取出該筆資料帶入（同 ProductForm 作法）。
 */
export default function CoachForm() {
  const { t, groupClassesEnabled } = useTerms();
  const { id } = useParams<{ id: string }>();
  const coachId = id ? Number(id) : undefined;
  const isEdit = coachId != null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: listCoaches });
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers });

  const editingCoach = isEdit ? coaches?.find((c) => c.id === coachId) : undefined;

  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [lineName, setLineName] = useState('');
  const [phone, setPhone] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [sessionRate, setSessionRate] = useState<number | null>(0);
  const [coachTypes, setCoachTypes] = useState<CoachType[]>(['私人教練']);
  // 授課分店（至少一間）；新增時預設排序最前面的分店
  const branchList = useBranches();
  const [branchIds, setBranchIds] = useState<number[] | null>(null);
  const effectiveBranchIds = branchIds ?? (isEdit ? [] : branchList.defaultId != null ? [branchList.defaultId] : []);
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<number | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState('');
  const [photoSize, setPhotoSize] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (editingCoach) {
      setName(editingCoach.name);
      setAlias(editingCoach.alias ?? '');
      setLineName(editingCoach.line_name ?? '');
      setPhone(editingCoach.phone ?? '');
      setBankCode(editingCoach.bank_code ?? '');
      setBankAccount(editingCoach.bank_account ?? '');
      setSpecialty(editingCoach.specialty ?? '');
      setSessionRate(editingCoach.session_rate ?? 0);
      setCoachTypes(editingCoach.coach_types);
      setBranchIds(editingCoach.branch_ids);
      setPickedId(editingCoach.user_id);
      setExistingPhotoUrl(editingCoach.photo_url ?? null);
      setPhotoFile(null);
      setPhotoPreview(null);
      setPhotoName('');
      setPhotoSize('');
      setPhotoError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCoach?.id]);

  const boundUserIds = useMemo(() => {
    const ids = new Set((coaches ?? []).map((c) => c.user_id));
    if (editingCoach) ids.delete(editingCoach.user_id);
    return ids;
  }, [coaches, editingCoach]);

  const memberById = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members]);
  const picked = pickedId != null ? memberById.get(pickedId) : undefined;
  const pickedUsername = picked?.username ?? (pickedId != null ? `#${pickedId}` : '');

  const q = query.trim().toLowerCase();
  const matches = q
    ? (members ?? [])
        .filter((m) => m.username.toLowerCase().includes(q) || String(m.id).includes(q))
        .slice(0, 6)
    : [];

  const phoneOk = PHONE_RE.test(phone.trim());
  const phoneBad = phone.length > 0 && !phoneOk;
  const bankCodeBad = bankCode.length > 0 && bankCode.length !== 3;
  const bankAccountBad = bankAccount.length > 0 && bankAccount.length < 10;

  let bankNote = `用於${t.staffPay}撥款，僅管理員可見`;
  if (bankCodeBad) bankNote = '銀行代號為 3 碼數字';
  else if (bankAccountBad) bankNote = '銀行帳號請輸入 10–16 碼數字';

  const dirty =
    isEdit && editingCoach != null
      ? name !== editingCoach.name ||
        alias !== (editingCoach.alias ?? '') ||
        lineName !== (editingCoach.line_name ?? '') ||
        phone !== (editingCoach.phone ?? '') ||
        bankCode !== (editingCoach.bank_code ?? '') ||
        bankAccount !== (editingCoach.bank_account ?? '') ||
        specialty !== (editingCoach.specialty ?? '') ||
        sessionRate !== (editingCoach.session_rate ?? 0) ||
        coachTypes.join() !== editingCoach.coach_types.join() ||
        [...effectiveBranchIds].sort().join() !== [...editingCoach.branch_ids].sort().join() ||
        photoFile != null ||
        existingPhotoUrl !== (editingCoach.photo_url ?? null)
      : true;

  const isPrivate = coachTypes.includes('私人教練');
  const baseValid =
    name.trim() !== '' &&
    phoneOk &&
    !bankCodeBad &&
    !bankAccountBad &&
    coachTypes.length > 0 &&
    effectiveBranchIds.length > 0 &&
    (!isPrivate || sessionRate !== null);
  const ready = isEdit ? baseValid && dirty : baseValid && picked != null;

  let readyLabel: string;
  if (isEdit) {
    readyLabel = !dirty ? '尚無變更' : ready ? '資料完整，可儲存' : '姓名與電話為必填';
  } else {
    readyLabel = ready ? '資料完整，可儲存' : '姓名、電話與綁定帳號皆為必填';
  }

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('檔案超過 2MB，請壓縮後再上傳');
      return;
    }
    setPhotoError('');
    setPhotoFile(file);
    setPhotoName(file.name);
    setPhotoSize(`${(file.size / 1024 / 1024).toFixed(2)} MB`);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoName('');
    setPhotoSize('');
    setPhotoError('');
    setExistingPhotoUrl(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let photoUrl: string | null | undefined = existingPhotoUrl;
      if (photoFile) photoUrl = await uploadCoachPhoto(photoFile);

      if (isEdit && coachId != null) {
        const payload: Partial<CoachPayload> = {
          name: name.trim(),
          alias: alias.trim() || null,
          line_name: lineName.trim() || null,
          phone: phone.trim(),
          bank_code: bankCode || null,
          bank_account: bankAccount || null,
          specialty: specialty.trim() || null,
          photo_url: photoUrl ?? null,
          session_rate: sessionRate ?? 0,
          coach_types: coachTypes,
          branch_ids: effectiveBranchIds,
        };
        return updateCoach(coachId, payload);
      }

      const payload: CoachPayload = {
        user_id: picked!.id,
        name: name.trim(),
        alias: alias.trim() || null,
        line_name: lineName.trim() || null,
        phone: phone.trim(),
        bank_code: bankCode || null,
        bank_account: bankAccount || null,
        specialty: specialty.trim() || null,
        photo_url: photoUrl ?? null,
        session_rate: sessionRate ?? 0,
        coach_types: coachTypes,
        branch_ids: effectiveBranchIds,
      };
      return createCoach(payload);
    },
    onSuccess: () => {
      message.success(isEdit ? '已儲存變更' : `已新增${t.staff}`);
      queryClient.invalidateQueries({ queryKey: ['coaches'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      navigate('/admin/coaches');
    },
    onError: (error) => {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      message.error(typeof detail === 'string' ? detail : '儲存失敗，請稍後再試');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCoach(coachId!),
    onSuccess: () => {
      setDeleteOpen(false);
      message.success(`已刪除${t.staff}資料`);
      queryClient.invalidateQueries({ queryKey: ['coaches'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      navigate('/admin/coaches');
    },
    onError: () => message.error('刪除失敗，請稍後再試'),
  });

  const labelCol: React.CSSProperties = {
    width: 96,
    flex: 'none',
    textAlign: 'right',
    fontSize: 14,
    color: token.colorText,
  };
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12 };
  const rowTop: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 12 };
  const required = <span style={{ color: token.colorError, marginRight: 4 }}>*</span>;
  const hint = (children: React.ReactNode, danger = false) => (
    <span style={{ fontSize: 13, color: danger ? token.colorError : token.colorTextTertiary }}>{children}</span>
  );

  // 直接以網址開啟編輯頁：等列表快取載入
  if (isEdit && coaches == null) {
    return (
      <Card>
        <Skeleton active />
      </Card>
    );
  }
  if (isEdit && !editingCoach) {
    return (
      <Card>
        <Result
          status="404"
          title={`找不到此${t.staff}資料`}
          subTitle="可能已被刪除，請返回列表重新確認。"
          extra={
            <Button type="primary" onClick={() => navigate('/admin/coaches')}>
              返回{t.staff}資料列表
            </Button>
          }
        />
      </Card>
    );
  }

  const previewSrc = photoPreview ?? existingPhotoUrl;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Breadcrumb
          items={[
            { title: `${t.staff}管理` },
            { title: `${t.staff}資料列表` },
            { title: isEdit ? `編輯${t.staff}資料` : `新增${t.staff}` },
          ]}
        />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.3 }}>
            {isEdit ? `編輯${t.staff}資料` : `新增${t.staff}`}
          </div>
          <div style={{ fontSize: 13, color: token.colorTextTertiary, paddingBottom: 4 }}>
            {isEdit
              ? `綁定帳號 ${pickedUsername}，此帳號身份為${t.staff}（類型見下方）`
              : `綁定後該會員帳號的身份會變成${t.staff}，類型於下方設定`}
          </div>
        </div>
      </div>

      <Card
        title={`${t.staff}資料`}
        extra={
          isEdit && editingCoach
            ? `${t.staff}編號 #${editingCoach.id} · 建立於 ${fmtDateTime(editingCoach.created_at)}`
            : undefined
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 840 }}>
          <div style={row}>
            <div style={labelCol}>{required}姓名</div>
            <Input
              style={{ width: 320 }}
              placeholder="例如：林佩君"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {hint('顯示於排程與會員預約畫面')}
          </div>

          <div style={row}>
            <div style={labelCol}>{t.teach}名稱</div>
            <Input
              style={{ width: 320 }}
              placeholder="例如：Coach Pei"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
            {hint('課表與預約畫面對會員顯示的稱呼，留空則顯示姓名')}
          </div>

          <div style={row}>
            <div style={labelCol}>Line 名稱</div>
            <Input
              style={{ width: 320 }}
              placeholder="Line ID 或顯示名稱"
              value={lineName}
              onChange={(e) => setLineName(e.target.value)}
            />
            {hint('僅供管理員聯繫用')}
          </div>

          <div style={row}>
            <div style={labelCol}>{required}電話</div>
            <Input
              style={{ width: 320 }}
              placeholder="0912-345-678"
              value={phone}
              status={phoneBad ? 'error' : undefined}
              onChange={(e) => setPhone(e.target.value)}
            />
            {hint(phoneBad ? '請輸入有效的聯絡電話' : '供管理員聯繫用，不對會員顯示', phoneBad)}
          </div>

          <div style={row}>
            <div style={labelCol}>匯款帳號</div>
            <Input
              style={{ width: 110 }}
              placeholder="銀行代號"
              value={bankCode}
              status={bankCodeBad ? 'error' : undefined}
              onChange={(e) => setBankCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
            />
            <Input
              style={{ width: 240 }}
              placeholder="銀行帳號"
              value={bankAccount}
              status={bankAccountBad ? 'error' : undefined}
              onChange={(e) => setBankAccount(e.target.value.replace(/[^0-9]/g, '').slice(0, 16))}
            />
            {hint(bankNote, bankCodeBad || bankAccountBad)}
          </div>

          <div style={row}>
            <div style={labelCol}>{required}類型</div>
            <Checkbox.Group
              value={coachTypes}
              onChange={(v) => setCoachTypes(normalizeCoachTypes(coachTypes, v as CoachType[]))}
              // 沒開團體課程的店不顯示「團體課程教練」（已勾的保留）
              options={COACH_TYPES.filter(
                (type) => type !== '團體課程教練' || groupClassesEnabled || coachTypes.includes(type),
              ).map((type) => ({ value: type, label: coachTypeLabel(type, t) }))}
            />
            {hint(
              coachTypes.length === 0
                ? '請至少選擇一種類型'
                : coachTypes.includes('場租教練')
                  ? `${t.rentalStaff}不屬於公司，來租借場地，系統不計費用`
                  : `${t.private}依下方每${t.unit}費用${groupClassesEnabled ? '、團體課依各課程設定的費用' : ''}計算`,
              coachTypes.length === 0,
            )}
          </div>

          <div style={row}>
            <div style={labelCol}>{required}{t.teach}分店</div>
            <Checkbox.Group
              value={effectiveBranchIds}
              onChange={(v) => setBranchIds(v as number[])}
              options={branchList.branches
                .filter((b) => b.is_active || effectiveBranchIds.includes(b.id))
                .map((b) => ({ value: b.id, label: b.name }))}
            />
            {hint(
              effectiveBranchIds.length === 0 ? '請至少選擇一間分店' : `會員預約${t.private}時，只會在這些分店看到這位${t.staff}`,
              effectiveBranchIds.length === 0,
            )}
          </div>

          {isPrivate && (
          <div style={row}>
            <div style={labelCol}>{required}{t.private}{t.unit === '堂' ? '鐘點費' : '服務費'}</div>
            <InputNumber
              style={{ width: 200 }}
              min={0}
              precision={0}
              prefix="NT$"
              suffix={`／${t.unit}`}
              value={sessionRate}
              status={sessionRate === null ? 'error' : undefined}
              onChange={(v) => setSessionRate(v)}
            />
            {hint(
              sessionRate === null
                ? `請輸入每${t.unit}費用，不支薪請填 0`
                : `${t.private}：已出席與未到的${t.hours} × 費率。僅管理員可見`,
              sessionRate === null,
            )}
          </div>
          )}

          <div style={rowTop}>
            <div style={{ ...labelCol, paddingTop: 6 }}>專長</div>
            <Input.TextArea
              style={{ flex: 1, minHeight: 96 }}
              autoSize={{ minRows: 4 }}
              placeholder={`擅長項目、證照、適合的${t.customer}類型⋯`}
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            />
          </div>

          <div style={rowTop}>
            <div style={{ ...labelCol, paddingTop: 6 }}>{t.staff}照片</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                style={{ display: 'none' }}
                onChange={pickPhoto}
              />
              {previewSrc ? (
                <div
                  style={{
                    width: 120,
                    height: 150,
                    borderRadius: token.borderRadius,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    backgroundColor: token.colorFillAlter,
                    backgroundImage: `url("${previewSrc}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: 120,
                    height: 150,
                    border: `1px dashed ${token.colorBorder}`,
                    borderRadius: token.borderRadius,
                    background: token.colorFillAlter,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    color: token.colorTextTertiary,
                  }}
                >
                  <PlusOutlined style={{ fontSize: 20 }} />
                  <span style={{ fontSize: 13 }}>上傳照片</span>
                </button>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
                {previewSrc ? (
                  <>
                    {photoName && (
                      <div
                        style={{
                          fontSize: 14,
                          color: token.colorText,
                          maxWidth: 280,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {photoName}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
                      {photoSize ? `${photoSize} · 儲存後套用` : '目前照片'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 2 }}>
                      <Button type="link" size="small" style={{ padding: 0 }} onClick={() => fileInputRef.current?.click()}>
                        更換照片
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0, color: token.colorTextSecondary }}
                        onClick={removePhoto}
                      >
                        移除
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: token.colorTextSecondary }}>
                      會員預約畫面與排程會顯示這張照片
                    </div>
                    <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
                      建議 4:5 直式、600 × 750 以上，限 jpg、png，單檔 2MB 以內
                    </div>
                  </>
                )}
                {photoError && <div style={{ fontSize: 12, color: token.colorError }}>{photoError}</div>}
              </div>
            </div>
          </div>

          <div style={rowTop}>
            <div style={{ ...labelCol, paddingTop: 6 }}>
              {isEdit ? null : required}
              綁定帳號
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {isEdit ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: 520,
                      padding: '10px 12px',
                      background: token.colorFillAlter,
                      border: `1px solid ${token.colorBorderSecondary}`,
                      borderRadius: token.borderRadius,
                    }}
                  >
                    <Avatar size={32}>{(pickedUsername.charAt(0) || 'C').toUpperCase()}</Avatar>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: token.colorText }}>{pickedUsername}</div>
                      <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
                        會員編號 #{editingCoach!.user_id}
                        {picked ? ` · 加入時間 ${fmtDate(picked.created_at)}` : ''}
                      </div>
                    </div>
                    <Tag>不可變更</Tag>
                  </div>
                  <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
                    一個帳號只能對應一筆{t.staff}資料；如需換綁請刪除本筆後重新建立
                  </div>
                </>
              ) : picked ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: 520,
                    padding: '10px 12px',
                    background: token.colorFillAlter,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: token.borderRadius,
                  }}
                >
                  <Avatar size={32}>{picked.username.charAt(0).toUpperCase()}</Avatar>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: token.colorText }}>{picked.username}</div>
                    <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
                      會員編號 #{picked.id} · 加入時間 {fmtDate(picked.created_at)}
                    </div>
                  </div>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setPickedId(null);
                      setQuery('');
                    }}
                  >
                    更換帳號
                  </Button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 320 }}>
                    <Input
                      style={{ width: 320 }}
                      placeholder="輸入會員帳號或編號搜尋"
                      prefix={<SearchOutlined />}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {matches.length > 0 && (
                      <div
                        style={{
                          width: 320,
                          background: token.colorBgContainer,
                          border: `1px solid ${token.colorBorderSecondary}`,
                          borderRadius: token.borderRadius,
                          boxShadow: token.boxShadowTertiary,
                          padding: 4,
                          maxHeight: 288,
                          overflowY: 'auto',
                        }}
                      >
                        {matches.map((m) => {
                          const bound = boundUserIds.has(m.id);
                          return (
                            <div
                              key={m.id}
                              onClick={() => {
                                if (bound) return;
                                setPickedId(m.id);
                                setQuery('');
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '7px 10px',
                                borderRadius: token.borderRadiusSM,
                                cursor: bound ? 'not-allowed' : 'pointer',
                                opacity: bound ? 0.45 : 1,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 14,
                                  color: token.colorText,
                                  flex: 1,
                                  minWidth: 0,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {m.username}
                              </span>
                              {bound && <Tag color="warning">已綁定{t.staff}</Tag>}
                              <span style={{ fontSize: 12, color: token.colorTextQuaternary }}>#{m.id}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {q.length > 0 && matches.length === 0 && (
                      <div
                        style={{
                          width: 320,
                          background: token.colorBgContainer,
                          border: `1px solid ${token.colorBorderSecondary}`,
                          borderRadius: token.borderRadius,
                          boxShadow: token.boxShadowTertiary,
                          padding: 16,
                          textAlign: 'center',
                          fontSize: 13,
                          color: token.colorTextTertiary,
                        }}
                      >
                        查無符合的會員帳號
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
                    僅能綁定既有會員帳號；一個帳號只能對應一筆{t.staff}資料
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 24px',
          margin: '0 -24px -24px',
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: token.boxShadowSecondary,
        }}
      >
        {isEdit && (
          <Button type="text" danger onClick={() => setDeleteOpen(true)}>
            刪除{t.staff}資料
          </Button>
        )}
        <span style={{ fontSize: 13, color: token.colorTextTertiary }}>{readyLabel}</span>
        <div style={{ flex: 1 }} />
        <Button onClick={() => navigate('/admin/coaches')}>取消</Button>
        <Button type="primary" disabled={!ready} loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {isEdit ? '儲存變更' : '確定'}
        </Button>
      </div>

      <Modal open={deleteOpen} title={`刪除${t.staff}資料`} footer={null} width={420} onCancel={() => setDeleteOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <ExclamationCircleFilled style={{ fontSize: 20, color: token.colorError, lineHeight: 1.4 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 14, color: token.colorText }}>
                確定要刪除「{editingCoach?.name}」的{t.staff}資料？
              </div>
              <div style={{ fontSize: 13, color: token.colorTextSecondary, lineHeight: 1.6 }}>
                刪除後綁定帳號 {pickedUsername} 的身份會回復為{t.customer}，既有{t.service}與預約需另行調整。此動作無法復原。
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDeleteOpen(false)}>取消</Button>
            <Button type="primary" danger loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              確定刪除
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

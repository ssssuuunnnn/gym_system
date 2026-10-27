import { useEffect, useRef, useState } from 'react';
import { Avatar, Breadcrumb, Button, Card, Input, InputNumber, Skeleton, Typography, message, theme } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { getSettings, updateSettings, uploadSettingsLogo } from '../../../api/settings';
import { LineNotifyCard } from './components/LineNotifyCard';
import { LineOaCard } from './components/LineOaCard';

const { Text } = Typography;

const DEFAULT_NAME = '健身工作室管理系統';

/**
 * 系統設定：對應「系統設定 → 基本資料」。全站僅一筆設定，非清單／詳情資源，
 * 儲存後套用至後台側欄與會員 App 的品牌顯示（見 components/AppLayout.tsx）。
 * 「預約規則」區塊設定取消期限：已確認的預約在開課前 N 小時內取消不退堂（0＝不限制）。
 * 「預約與付款」區塊另有付款方式說明（會員待付款時看到）。
 * 「LINE 官方帳號」（docs/adr/0005-gym-line-oa.md）與「LINE 通知」（docs/adr/0004-line-notifications.md）操作立即生效。
 */
export default function SystemSettings() {
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: getSettings,
  });

  const [companyName, setCompanyName] = useState('');
  const [shortName, setShortName] = useState('');
  const [deadlineHours, setDeadlineHours] = useState<number | null>(12);
  const [paymentInfo, setPaymentInfo] = useState('');

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState('');
  const [logoError, setLogoError] = useState('');
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);

  // 僅在載入到（或儲存後重新整理出）新的設定值時重設表單，避免背景重新整理把使用者的編輯清掉
  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name);
      setShortName(settings.short_name ?? '');
      setDeadlineHours(settings.cancel_deadline_hours);
      setPaymentInfo(settings.payment_instructions ?? '');
      setLogoFile(null);
      setLogoPreview(null);
      setLogoSize('');
      setLogoError('');
      setExistingLogoUrl(settings.logo_url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.updated_at]);

  const nameEmpty = companyName.trim() === '';
  const deadlineInvalid = deadlineHours === null;

  const changes: string[] = [];
  if (settings) {
    if (companyName.trim() !== settings.company_name) changes.push('公司名稱');
    if (shortName.trim() !== (settings.short_name ?? '')) changes.push('顯示簡稱');
    if (logoFile != null || existingLogoUrl !== (settings.logo_url ?? null)) changes.push('LOGO');
    if (deadlineHours !== settings.cancel_deadline_hours) changes.push('取消期限');
    if (paymentInfo.trim() !== (settings.payment_instructions ?? '')) changes.push('付款方式說明');
  }

  const pickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('檔案超過 2MB，請壓縮後再上傳');
      return;
    }
    setLogoError('');
    setLogoFile(file);
    setLogoSize(`${(file.size / 1024).toFixed(0)} KB`);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoSize('');
    setLogoError('');
    setExistingLogoUrl(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let logoUrl: string | null | undefined = existingLogoUrl;
      if (logoFile) logoUrl = await uploadSettingsLogo(logoFile);

      if (changes.length === 0) return;
      await updateSettings({
        company_name: companyName.trim(),
        short_name: shortName.trim() || null,
        logo_url: logoUrl ?? null,
        cancel_deadline_hours: deadlineHours ?? undefined,
        payment_instructions: paymentInfo.trim() || null,
      });
    },
    onSuccess: () => {
      message.success('已儲存變更');
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
    onError: (error) => {
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      message.error(typeof detail === 'string' ? detail : '儲存失敗，請稍後再試');
    },
  });

  if (isLoading || !settings) {
    return (
      <Card>
        <Skeleton active />
      </Card>
    );
  }

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

  const previewSrc = logoPreview ?? existingLogoUrl;
  const displayName = (shortName.trim() || companyName.trim()) || DEFAULT_NAME;
  const markInitial = displayName.charAt(0).toUpperCase();

  let dirtyLabel = '尚無變更';
  let dirtyColor = token.colorTextTertiary;
  if (nameEmpty) {
    dirtyLabel = '公司名稱為必填';
    dirtyColor = token.colorError;
  } else if (deadlineInvalid) {
    dirtyLabel = '取消期限為必填（不限制請填 0）';
    dirtyColor = token.colorError;
  } else if (changes.length > 0) {
    dirtyLabel = `待儲存：${changes.join('、')}`;
  }

  const saveDisabled = nameEmpty || deadlineInvalid || changes.length === 0 || saveMutation.isPending;

  const handleCancel = () => {
    setCompanyName(settings.company_name);
    setShortName(settings.short_name ?? '');
    setDeadlineHours(settings.cancel_deadline_hours);
    setPaymentInfo(settings.payment_instructions ?? '');
    setLogoFile(null);
    setLogoPreview(null);
    setLogoSize('');
    setLogoError('');
    setExistingLogoUrl(settings.logo_url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Breadcrumb items={[{ title: '系統設定' }, { title: '基本資料' }]} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.3 }}>系統設定</div>
          <div style={{ fontSize: 13, color: token.colorTextTertiary, paddingBottom: 4 }}>
            公司名稱與 LOGO 會顯示於後台側欄、會員 App 與通知信件
          </div>
        </div>
      </div>

      <Card title="基本資料">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 840 }}>
          <div style={row}>
            <div style={labelCol}>{required}公司名稱</div>
            <Input
              style={{ width: 320 }}
              placeholder="例如：脈動健身有限公司"
              value={companyName}
              status={nameEmpty ? 'error' : undefined}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Text style={{ fontSize: 13 }} type={nameEmpty ? 'danger' : 'secondary'}>
              {nameEmpty ? '公司名稱不可空白' : '顯示於報表抬頭與通知信件署名'}
            </Text>
          </div>

          <div style={row}>
            <div style={labelCol}>顯示簡稱</div>
            <Input
              style={{ width: 320 }}
              placeholder="例如：PulseFit"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
            />
            <Text style={{ fontSize: 13 }} type="secondary">
              側欄與行動版顯示用，留空則顯示公司名稱
            </Text>
          </div>

          <div style={rowTop}>
            <div style={{ ...labelCol, paddingTop: 6 }}>公司 LOGO</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                style={{ display: 'none' }}
                onChange={pickLogo}
              />
              {previewSrc ? (
                <div
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: token.borderRadius,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    backgroundColor: '#fff',
                    backgroundImage: `url("${previewSrc}")`,
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: 160,
                    height: 160,
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
                  <span style={{ fontSize: 13 }}>上傳 LOGO</span>
                </button>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
                {previewSrc ? (
                  <>
                    <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
                      {logoSize ? `${logoSize} · 儲存後套用至全站` : '目前 LOGO'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Button type="link" size="small" style={{ padding: 0 }} onClick={() => fileInputRef.current?.click()}>
                        更換 LOGO
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0, color: token.colorTextSecondary }}
                        onClick={removeLogo}
                      >
                        移除
                      </Button>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: token.colorTextSecondary }}>
                    未上傳時，側欄會以公司名稱首字作為文字標記
                  </div>
                )}
                <div style={{ fontSize: 12, color: token.colorTextTertiary, lineHeight: 1.7 }}>
                  支援 PNG、JPG，建議正方形、透明背景
                  <br />
                  最小 256 × 256，單檔 2MB 以內
                </div>
                {logoError && <div style={{ fontSize: 12, color: token.colorError }}>{logoError}</div>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 8 }}>
                <div style={{ fontSize: 12, color: token.colorTextTertiary }}>側欄顯示預覽</div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: 208,
                    height: 64,
                    padding: '0 20px',
                    background: '#fff',
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: token.borderRadius,
                  }}
                >
                  {previewSrc ? (
                    <Avatar shape="square" size={28} src={previewSrc} />
                  ) : (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        flex: 'none',
                        borderRadius: token.borderRadiusSM,
                        background: token.colorPrimary,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {markInitial}
                    </div>
                  )}
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: token.colorText,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {displayName}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="預約與付款">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 840 }}>
          <div style={row}>
            <div style={labelCol}>{required}取消期限</div>
            <InputNumber
              style={{ width: 180 }}
              min={0}
              max={168}
              precision={0}
              value={deadlineHours}
              status={deadlineInvalid ? 'error' : undefined}
              onChange={(v) => setDeadlineHours(v)}
              prefix="開課前"
              suffix="小時"
            />
            <Text style={{ fontSize: 13 }} type={deadlineInvalid ? 'danger' : 'secondary'}>
              {deadlineHours === 0
                ? '目前不限制：已確認的預約隨時取消都會退堂'
                : '已確認的預約在此期限內取消，仍可取消但不退堂；管理員取消時可例外退堂'}
            </Text>
          </div>
          <div style={rowTop}>
            <label htmlFor="payment-instructions" style={{ ...labelCol, paddingTop: 6 }}>
              付款方式說明
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, maxWidth: 480 }}>
              <Input.TextArea
                id="payment-instructions"
                rows={3}
                maxLength={500}
                showCount
                placeholder={'例如：轉帳至 國泰世華（013）1234-5678-9012，戶名 脈動健身\n轉帳後請告知末五碼，或到櫃台以現金、刷卡付款'}
                value={paymentInfo}
                onChange={(e) => setPaymentInfo(e.target.value)}
              />
              <Text style={{ fontSize: 13 }} type="secondary">
                會員自行下單（待付款）後，在「我的方案與訂單」看到這段說明
              </Text>
            </div>
          </div>
        </div>
      </Card>

      {/* LINE 官方帳號與 LINE 通知：各項操作立即生效，不經過下方的「儲存變更」 */}
      <LineOaCard />
      <LineNotifyCard />

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
        <span style={{ fontSize: 13, color: dirtyColor }}>{dirtyLabel}</span>
        <div style={{ flex: 1 }} />
        <Button onClick={handleCancel}>取消</Button>
        <Button type="primary" disabled={saveDisabled} loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          儲存變更
        </Button>
      </div>
    </div>
  );
}

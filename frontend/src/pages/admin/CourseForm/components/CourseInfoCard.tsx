import { useRef } from 'react';
import { Card, Input, InputNumber, Select, Button, theme } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import { FieldRow } from './FieldRow';
import { DURATION_OPTIONS } from '../lib/recurrence';

export interface CourseInfoValue {
  name: string;
  coachId: number | null;
  minCapacity: number | null;
  maxCapacity: number | null;
  description: string;
  durationMinutes: number;
}

export interface CourseInfoCardProps {
  value: CourseInfoValue;
  onChange: (patch: Partial<CourseInfoValue>) => void;
  coachOptions: { value: number; label: string }[];
  /** 已上傳／既有封面預覽網址（含尚未儲存的本機預覽） */
  coverPreview: string | null;
  coverHint: string;
  onPickCover: (file: File) => void;
  onRemoveCover: () => void;
}

const COVER_ACCEPT = 'image/png,image/jpeg';

export function CourseInfoCard(props: CourseInfoCardProps) {
  const { value, onChange, coachOptions, coverPreview, coverHint, onPickCover, onRemoveCover } = props;
  const { token } = theme.useToken();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card title="課程資訊">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 840 }}>
        <FieldRow label="課程名稱" required>
          <Input
            placeholder="例如：活力瑜伽"
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            style={{ width: 320 }}
          />
        </FieldRow>

        <FieldRow label="教練名稱" required>
          <Select
            placeholder="請選擇教練"
            value={value.coachId ?? undefined}
            onChange={(v) => onChange({ coachId: v })}
            options={coachOptions}
            style={{ width: 320 }}
            showSearch
            optionFilterProp="label"
          />
        </FieldRow>

        <FieldRow label="開班人數" required>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <InputNumber
              placeholder="最低開班"
              min={1}
              max={100}
              value={value.minCapacity}
              onChange={(v) => onChange({ minCapacity: v })}
              style={{ width: 110 }}
            />
            <span style={{ fontSize: 14, color: token.colorTextSecondary }}>人，上限</span>
            <InputNumber
              placeholder="報名上限"
              min={1}
              max={100}
              value={value.maxCapacity}
              onChange={(v) => onChange({ maxCapacity: v })}
              style={{ width: 110 }}
            />
            <span style={{ fontSize: 14, color: token.colorTextSecondary }}>人</span>
            <span style={{ fontSize: 13, color: token.colorTextTertiary, marginLeft: 4 }}>
              未達開班人數時系統會於開課前 24 小時提醒
            </span>
          </div>
        </FieldRow>

        <FieldRow label="單堂時長" required>
          <Select
            value={value.durationMinutes}
            onChange={(v) => onChange({ durationMinutes: v })}
            options={DURATION_OPTIONS.map((m) => ({ value: m, label: `${m} 分鐘` }))}
            style={{ width: 140 }}
          />
        </FieldRow>

        <FieldRow label="課程介紹" alignTop>
          <Input.TextArea
            placeholder="課程強度、適合對象、需自備的器材⋯"
            value={value.description}
            onChange={(e) => onChange({ description: e.target.value })}
            autoSize={{ minRows: 4, maxRows: 8 }}
          />
        </FieldRow>

        <FieldRow label="課程封面" alignTop>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <input
              ref={fileRef}
              type="file"
              accept={COVER_ACCEPT}
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPickCover(file);
                e.target.value = '';
              }}
            />
            {coverPreview ? (
              <div
                style={{
                  width: 280,
                  height: 158,
                  borderRadius: token.borderRadius,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  backgroundColor: token.colorFillAlter,
                  backgroundImage: `url("${coverPreview}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  width: 280,
                  height: 158,
                  border: `1px dashed ${token.colorBorder}`,
                  borderRadius: token.borderRadius,
                  background: token.colorFillTertiary,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  color: token.colorTextTertiary,
                }}
              >
                <PictureOutlined style={{ fontSize: 24 }} />
                <span style={{ fontSize: 13 }}>點擊選擇圖片上傳</span>
              </button>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
              <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
                建議大小 1200 × 675，限 jpg、png，單檔 2MB 以內
              </div>
              {coverHint && (
                <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{coverHint}</div>
              )}
              {coverPreview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 2 }}>
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => fileRef.current?.click()}>
                    更換圖片
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, color: token.colorTextSecondary }}
                    onClick={onRemoveCover}
                  >
                    移除
                  </Button>
                </div>
              )}
            </div>
          </div>
        </FieldRow>
      </div>
    </Card>
  );
}

import { Button, Checkbox, Tag, Typography, theme } from 'antd';
import { REQUIRED_SECTIONS, SECTION_LABEL, type SectionKey, type SiteContent } from '../../../../api/website';
import { moveItem } from '../lib';
import { ListItemActions } from './ListItemActions';

export type EditorTarget = 'settings' | SectionKey;

export interface SectionNavProps {
  sections: SiteContent['sections'];
  current: EditorTarget;
  onSelect: (target: EditorTarget) => void;
  onChange: (sections: SiteContent['sections']) => void;
}

/** 左側段落清單：選擇要編輯的段落、勾選是否顯示、調整順序。必備段落不能關閉。 */
export function SectionNav({ sections, current, onSelect, onChange }: SectionNavProps) {
  const { token } = theme.useToken();

  const item = (key: EditorTarget, label: string, extra: React.ReactNode) => {
    const selected = current === key;
    return (
      <div
        key={key}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          borderRadius: token.borderRadius,
          background: selected ? token.colorPrimaryBg : 'transparent',
          paddingRight: 4,
        }}
      >
        <Button
          type="text"
          onClick={() => onSelect(key)}
          aria-current={selected ? 'true' : undefined}
          style={{
            flex: '1 1 auto',
            justifyContent: 'flex-start',
            height: 40,
            color: selected ? token.colorPrimaryText : token.colorText,
            fontWeight: selected ? 600 : 400,
            background: 'transparent',
          }}
        >
          {label}
        </Button>
        {extra}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {item('settings', '網站設定', null)}
      <Typography.Text type="secondary" style={{ fontSize: 12, padding: '12px 8px 4px' }}>
        段落（由上到下就是網站的順序）
      </Typography.Text>
      {sections.map((s, index) => {
        const required = REQUIRED_SECTIONS.includes(s.key);
        return item(
          s.key,
          SECTION_LABEL[s.key],
          <>
            <ListItemActions
              index={index}
              count={sections.length}
              label={SECTION_LABEL[s.key]}
              onMove={(d) => onChange(moveItem(sections, index, d))}
            />
            {required ? (
              <Tag style={{ marginInlineEnd: 0 }}>必備</Tag>
            ) : (
              <Checkbox
                checked={s.visible}
                aria-label={`顯示「${SECTION_LABEL[s.key]}」`}
                onChange={(e) =>
                  onChange(sections.map((x, i) => (i === index ? { ...x, visible: e.target.checked } : x)))
                }
              />
            )}
          </>,
        );
      })}
      <Typography.Text type="secondary" style={{ fontSize: 12, padding: '8px 8px 0', lineHeight: 1.6 }}>
        取消勾選的段落不會出現在網站上；沒有內容的段落（例如還沒上傳照片）也會自動隱藏。
      </Typography.Text>
    </div>
  );
}

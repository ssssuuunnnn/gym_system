import { CheckCircleFilled } from '@ant-design/icons';
import { theme } from 'antd';
import { SITE_THEMES, type BrandColor, type SiteTheme } from '../../../../api/website';

export interface ThemePickerProps {
  value: SiteTheme;
  /** 目前的品牌色，縮圖會用它畫按鈕與重點色 */
  accent: BrandColor;
  onChange: (value: SiteTheme) => void;
}

/**
 * 形象網站版型選擇：每個版型一張縮圖（主視覺、標題、按鈕、卡片的示意），點選即切換；
 * 右側預覽會用實際內容顯示。縮圖顏色是網站版型本身的顏色（SITE_THEMES.swatch）。
 */
export function ThemePicker({ value, accent, onChange }: ThemePickerProps) {
  const { token } = theme.useToken();
  return (
    <div role="radiogroup" aria-label="版型" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
      {SITE_THEMES.map((t) => {
        const selected = value === t.key;
        const s = t.swatch;
        return (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(t.key)}
            style={{
              textAlign: 'left',
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: token.colorBgContainer,
              border: `${selected ? 2 : 1}px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
              overflow: 'hidden',
              color: token.colorText,
            }}
          >
            {s.layout === 'grid' ? <GridThumb swatch={s} accent={accent} /> : <StackThumb swatch={s} accent={accent} />}
            <div style={{ padding: '8px 10px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                {t.name}
                {selected && <CheckCircleFilled style={{ color: token.colorPrimary }} aria-label="使用中" />}
              </div>
              <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>{t.description}</div>
              <div style={{ fontSize: 12, color: token.colorTextTertiary, lineHeight: 1.5 }}>適合：{t.suits}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

type Swatch = (typeof SITE_THEMES)[number]['swatch'];

/** 由上而下段落的縮圖：主視覺（標題列＋按鈕＋照片）與下方兩張卡片 */
function StackThumb({ swatch: s, accent }: { swatch: Swatch; accent: string }) {
  const { token } = theme.useToken();
  return (
    <div aria-hidden="true" style={{ background: s.page, padding: 8, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      <div style={{ background: s.hero, borderRadius: 6, padding: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ height: 4, width: 24, background: accent, borderRadius: 2 }} />
          <div style={{ height: s.serif ? 6 : 8, width: '90%', background: s.heroText, borderRadius: s.serif ? 1 : 2, opacity: 0.9 }} />
          <div style={{ height: s.serif ? 6 : 8, width: '65%', background: s.heroText, borderRadius: s.serif ? 1 : 2, opacity: 0.9 }} />
          <div style={{ height: 10, width: 36, background: accent, borderRadius: s.radius > 20 ? 4 : 999, marginTop: 2 }} />
        </div>
        <div
          style={{
            width: 44,
            height: 50,
            background: `linear-gradient(135deg, ${accent}55, ${accent}22)`,
            borderRadius: s.radius > 20 ? `${s.radius}px ${s.radius}px 4px 4px` : s.radius,
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ flex: 1, height: 22, background: s.block, borderRadius: Math.min(s.radius, 10), border: `1px solid ${token.colorBorderSecondary}` }} />
        ))}
      </div>
    </div>
  );
}

/** 方格版型的縮圖：深色主視覺方塊、照片、下一堂課（品牌色）與其他小方塊 */
function GridThumb({ swatch: s, accent }: { swatch: Swatch; accent: string }) {
  const { token } = theme.useToken();
  const tile = (style: React.CSSProperties) => ({ borderRadius: s.radius, background: s.block, ...style });
  return (
    <div
      aria-hidden="true"
      style={{
        background: s.page,
        padding: 8,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridAutoRows: 19,
        gap: 4,
      }}
    >
      <div style={tile({ gridColumn: 'span 2', gridRow: 'span 2', background: s.hero, padding: 6, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 3 })}>
        <div style={{ height: 5, width: '85%', background: s.heroText, borderRadius: 2 }} />
        <div style={{ height: 6, width: 22, background: accent, borderRadius: 999 }} />
      </div>
      <div style={tile({ gridRow: 'span 2', background: `linear-gradient(135deg, ${accent}55, ${accent}22)` })} />
      <div style={tile({ background: accent })} />
      <div style={tile({})} />
      <div style={tile({ gridColumn: 'span 4' })} />
    </div>
  );
}

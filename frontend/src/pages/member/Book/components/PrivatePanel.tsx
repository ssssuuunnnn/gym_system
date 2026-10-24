import { Button, theme } from 'antd';
import type { Coach } from '../../../../api/coaches';
import FrontCard from '../../../../components/member/FrontCard';

export interface PrivateHour {
  hour: number;
  /** 公休或已過的時段不可選 */
  disabled: boolean;
}

export interface PrivatePanelProps {
  /** 可指定的私人教練 */
  coaches: Coach[];
  coachId: number | null;
  onCoachChange: (id: number) => void;
  hours: PrivateHour[];
  onPickHour: (hour: number) => void;
}

/** 私人課：先選教練，再選時段（整點，公休與已過時段停用）。 */
export function PrivatePanel({ coaches, coachId, onCoachChange, hours, onPickHour }: PrivatePanelProps) {
  const { token } = theme.useToken();
  const sectionTitle = { margin: 0, fontSize: 15, fontWeight: 700 } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section aria-labelledby="pick-coach" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 id="pick-coach" style={sectionTitle}>
          選擇教練
        </h2>
        {coaches.length === 0 ? (
          <FrontCard style={{ fontSize: 14, color: token.colorTextSecondary }}>目前沒有可預約的私人教練</FrontCard>
        ) : (
          <div role="radiogroup" aria-label="教練" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {coaches.map((c) => {
              const selected = c.id === coachId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onCoachChange(c.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    height: 48,
                    padding: '0 16px 0 6px',
                    borderRadius: 100,
                    border: `1px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
                    background: selected ? token.colorPrimaryBg : token.colorBgContainer,
                    color: token.colorText,
                    fontFamily: 'inherit',
                    fontSize: 15,
                    fontWeight: selected ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {c.photo_url ? (
                    <img src={c.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover' }} />
                  ) : (
                    <span
                      aria-hidden="true"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        background: selected ? token.colorPrimary : token.colorBgLayout,
                        color: selected ? token.colorTextLightSolid : token.colorText,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                      }}
                    >
                      {(c.alias || c.name).charAt(0).toUpperCase()}
                    </span>
                  )}
                  {c.alias || c.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {coachId != null && (
        <section aria-labelledby="pick-hour" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 id="pick-hour" style={sectionTitle}>
            選擇時段
          </h2>
          {hours.every((h) => h.disabled) ? (
            <FrontCard style={{ fontSize: 14, color: token.colorTextSecondary }}>這天已沒有可預約的時段，換一天看看</FrontCard>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
              {hours.map((h) => (
                <Button key={h.hour} disabled={h.disabled} onClick={() => onPickHour(h.hour)} style={{ fontWeight: 500 }}>
                  {String(h.hour).padStart(2, '0')}:00
                </Button>
              ))}
            </div>
          )}
          <p style={{ margin: 0, fontSize: 12, color: token.colorTextSecondary }}>私人課以 1 小時為一堂，送出後由工作室與教練確認。</p>
        </section>
      )}
    </div>
  );
}

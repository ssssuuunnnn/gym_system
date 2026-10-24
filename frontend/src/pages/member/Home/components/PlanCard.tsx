import { Button, theme } from 'antd';
import { Link } from 'react-router-dom';
import type { Purchase } from '../../../../api/purchases';

export interface PlanCardProps {
  /** 目前顯示的方案（已付款且仍有堂數）；沒有時顯示購買引導 */
  plan: Purchase | undefined;
  /** 方案名稱 */
  planName: string;
  /** 其他仍有堂數的方案數量 */
  otherPlanCount: number;
}

/** 首頁主卡：主題色底、白字，大字顯示剩餘堂數與進度條。 */
export function PlanCard({ plan, planName, otherPlanCount }: PlanCardProps) {
  const { token } = theme.useToken();
  const onPrimary = token.colorTextLightSolid;

  if (!plan) {
    return (
      <section
        aria-label="我的方案"
        style={{ background: token.colorPrimary, color: onPrimary, borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <span style={{ fontSize: 14 }}>剩餘堂數</span>
        <span style={{ fontSize: 20, fontWeight: 700 }}>還沒有可使用的方案</span>
        <Link to="/member/purchase">
          <Button ghost block size="large" style={{ color: onPrimary, borderColor: onPrimary, fontWeight: 700 }}>
            購買方案
          </Button>
        </Link>
      </section>
    );
  }

  const used = plan.total_hours - plan.remaining_hours;
  const percent = plan.total_hours > 0 ? Math.round((plan.remaining_hours / plan.total_hours) * 100) : 0;

  return (
    <section
      aria-label="我的方案"
      style={{ background: token.colorPrimary, color: onPrimary, borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 14 }}>剩餘堂數</span>
        <span style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 100, border: `1px solid ${onPrimary}` }}>
          {planName}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 52, fontWeight: 700, lineHeight: 1 }}>{plan.remaining_hours}</span>
        <span style={{ fontSize: 16 }}>/ {plan.total_hours} 堂</span>
      </div>
      <div
        role="img"
        aria-label={`剩餘 ${plan.remaining_hours} 堂，共 ${plan.total_hours} 堂`}
        style={{ position: 'relative', height: 8 }}
      >
        <div style={{ position: 'absolute', inset: 0, borderRadius: 4, background: onPrimary, opacity: 0.25 }} />
        <div style={{ position: 'relative', height: 8, borderRadius: 4, background: onPrimary, width: `${percent}%` }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
        <span>已使用 {used} 堂</span>
        <Link to="/member/products" style={{ color: onPrimary, fontWeight: 500 }}>
          {otherPlanCount > 0 ? `還有 ${otherPlanCount} 個方案 ›` : '方案紀錄 ›'}
        </Link>
      </div>
    </section>
  );
}

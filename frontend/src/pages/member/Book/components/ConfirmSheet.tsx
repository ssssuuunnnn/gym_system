import { Button, Tag, theme } from 'antd';
import type { Dayjs } from 'dayjs';
import type { ReactNode } from 'react';
import BottomSheet from '../../../../components/member/BottomSheet';
import CoverTile from '../../../../components/member/CoverTile';
import { isoWeekday } from '../../../../lib/availability';
import { weekdayShort } from '../../../../lib/weekday';

export interface ConfirmSheetProps {
  open: boolean;
  /** 課程或方案名稱 */
  title: string;
  /** 例如「Mia 教練」 */
  subtitle: string;
  start: Dayjs | null;
  end: Dayjs | null;
  coverSrc?: string | null;
  /** 自動選定扣抵的方案；null 表示沒有可用方案 */
  planLabel: string | null;
  /** 方案選擇（私人課有多個方案時） */
  planPicker?: ReactNode;
  /** 取消期限（小時） */
  deadlineHours: number | undefined;
  submitting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** 沒有可用方案時的動作（前往購買） */
  onBuy: () => void;
  /** 沒有可用方案、但有適用的待付款訂單：顯示訂單名稱，改為引導查看付款方式 */
  unpaidPlanLabel?: string | null;
  onViewPayment?: () => void;
}

/**
 * 確認預約的底部面板：課程、時間、自動選定的方案（扣 1 堂）、免費取消時間。
 * 會員不需要自己挑購買紀錄；沒有可用方案時改為引導購買，已有待付款的適用方案時引導付款。
 */
export function ConfirmSheet(props: ConfirmSheetProps) {
  const { open, title, subtitle, start, end, coverSrc, planLabel, planPicker, deadlineHours, submitting, onConfirm, onClose, onBuy } = props;
  const { unpaidPlanLabel, onViewPayment } = props;
  const { token } = theme.useToken();
  const freeCancelUntil = start && deadlineHours ? start.subtract(deadlineHours, 'hour') : null;
  const row = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 0',
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  } as const;

  return (
    <BottomSheet open={open} onClose={onClose} title="確認預約">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CoverTile src={coverSrc} size={52} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
            <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
              {start && end ? `${start.format('M/D')}（${weekdayShort(isoWeekday(start))}）${start.format('HH:mm')}–${end.format('HH:mm')}` : ''}
              {subtitle ? ` · ${subtitle}` : ''}
            </span>
          </div>
        </div>

        <dl style={{ margin: 0, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <div style={row}>
            <dt style={{ fontSize: 14, color: token.colorTextSecondary }}>使用方案</dt>
            <dd style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, textAlign: 'right' }}>
              {planLabel ?? (
                <span style={{ color: token.colorWarningText }}>{unpaidPlanLabel ? `${unpaidPlanLabel}（待付款）` : '沒有可用的方案'}</span>
              )}
              {planLabel && (
                <Tag variant="filled" style={{ marginInlineEnd: 0, color: token.colorPrimary, background: token.colorPrimaryBg }}>
                  扣 1 堂
                </Tag>
              )}
            </dd>
          </div>
          {planPicker && <div style={{ padding: '12px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>{planPicker}</div>}
          {freeCancelUntil && (
            <div style={row}>
              <dt style={{ fontSize: 14, color: token.colorTextSecondary }}>免費取消</dt>
              <dd style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{freeCancelUntil.format('M/D HH:mm')} 前</dd>
            </div>
          )}
        </dl>

        <p style={{ margin: 0, fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.6 }}>
          送出後由工作室確認。{deadlineHours ? `開課前 ${deadlineHours} 小時內取消或未到，這堂不會退回。` : ''}
          開課前 30 分鐘起可在首頁簽到。
        </p>

        {!planLabel && unpaidPlanLabel && (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: token.colorWarningText }}>
            這個方案還在等工作室確認收款，確認後就能預約這堂課，我們會幫你記住這堂。
          </p>
        )}

        {planLabel ? (
          <Button type="primary" size="large" block loading={submitting} onClick={onConfirm} style={{ fontWeight: 700 }}>
            確認預約
          </Button>
        ) : unpaidPlanLabel ? (
          <Button type="primary" size="large" block onClick={onViewPayment} style={{ fontWeight: 700 }}>
            查看付款方式
          </Button>
        ) : (
          <Button type="primary" size="large" block onClick={onBuy} style={{ fontWeight: 700 }}>
            購買方案
          </Button>
        )}
        <Button type="text" size="large" block onClick={onClose}>
          再看看
        </Button>
      </div>
    </BottomSheet>
  );
}

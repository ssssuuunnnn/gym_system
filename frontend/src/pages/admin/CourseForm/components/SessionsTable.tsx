import type { CSSProperties } from 'react';
import { useState } from 'react';
import { Button, DatePicker, Popover, Select, Tag, message, theme } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { isoWeekday } from '../../../../lib/availability';
import { weekdayLabel } from '../../../../lib/weekday';
import {
  disabledPastDate,
  formatDateKey,
  formatMinute,
  TIME_OPTIONS,
  type IsSlotClosed,
  type PreviewSession,
} from '../lib/recurrence';

export interface SessionsTableProps {
  sessions: PreviewSession[];
  durationMinutes: number;
  isSlotClosed: IsSlotClosed;
  onToggleCancel: (dateKey: string) => void;
  onRemoveExtra: (key: string) => void;
  onAddExtra: (dateKey: string, minute: number) => void;
  readOnly?: boolean;
}

const COL = { idx: 48, date: 150, time: 130, source: 96, status: 96 };

function AddSessionPopover({
  isSlotClosed,
  onAdd,
}: {
  isSlotClosed: IsSlotClosed;
  onAdd: (dateKey: string, minute: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>('');
  const [minute, setMinute] = useState<number>(TIME_OPTIONS[0].value);

  const submit = () => {
    if (!date) {
      message.warning('請選擇日期');
      return;
    }
    if (isSlotClosed(date, minute)) {
      message.warning('此時段已關閉，無法開課');
      return;
    }
    onAdd(date, minute);
    setOpen(false);
    setDate('');
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      title="加開單堂"
      content={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 220 }}>
          <DatePicker
            allowClear={false}
            disabledDate={disabledPastDate}
            value={date ? dayjs(date) : null}
            onChange={(d) => d && setDate(d.format('YYYY-MM-DD'))}
            style={{ width: '100%' }}
          />
          <Select value={minute} onChange={setMinute} options={TIME_OPTIONS} style={{ width: '100%' }} />
          <Button type="primary" size="small" onClick={submit}>
            加開
          </Button>
        </div>
      }
    >
      <Button size="small" icon={<PlusOutlined />}>
        加開單堂
      </Button>
    </Popover>
  );
}

export function SessionsTable(props: SessionsTableProps) {
  const { sessions, durationMinutes, isSlotClosed, onToggleCancel, onRemoveExtra, onAddExtra, readOnly = false } =
    props;
  const { token } = theme.useToken();

  const headerCell: CSSProperties = { flex: 'none' };
  // 落在公休時段的課堂不進表格（落差由「開課期間」的摘要文字說明）
  const visible = sessions.filter((s) => !s.closedSlot);
  const activeCount = visible.filter((s) => !s.isCancelled).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>開課時間</div>
        <Tag color="processing">{activeCount} 堂</Tag>
        <div style={{ flex: 1 }} />
        {!readOnly && <AddSessionPopover isSlotClosed={isSlotClosed} onAdd={onAddExtra} />}
      </div>

      <div
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            background: token.colorFillAlter,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            fontSize: 13,
            fontWeight: 600,
            color: token.colorTextSecondary,
          }}
        >
          <div style={{ ...headerCell, width: COL.idx }}>序號</div>
          <div style={{ ...headerCell, width: COL.date }}>日期</div>
          <div style={{ ...headerCell, width: COL.time }}>時間</div>
          <div style={{ ...headerCell, width: COL.source }}>來源</div>
          <div style={{ ...headerCell, width: COL.status }}>狀態</div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>{!readOnly && '操作'}</div>
        </div>

        {visible.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: token.colorTextTertiary }}>
            尚未產生任何課堂，請於上方設定上課星期與開課期間
          </div>
        ) : (
          visible.map((s, i) => {
            const wd = isoWeekday(dayjs(s.dateKey));
            const groupHead = i === 0 || wd !== isoWeekday(dayjs(visible[i - 1].dateKey));
            return (
            <div key={s.key}>
            {groupHead && (
              <div
                style={{
                  padding: '6px 16px',
                  background: token.colorFillAlter,
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  fontSize: 12,
                  fontWeight: 600,
                  color: token.colorTextSecondary,
                }}
              >
                {weekdayLabel(wd)}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                fontSize: 14,
                minHeight: 44,
                opacity: s.isCancelled ? 0.55 : 1,
              }}
            >
              <div style={{ width: COL.idx, flex: 'none', color: token.colorTextQuaternary, fontSize: 13 }}>
                {i + 1}.
              </div>
              <div style={{ width: COL.date, flex: 'none', color: token.colorText }}>
                {formatDateKey(s.dateKey)}
              </div>
              <div style={{ width: COL.time, flex: 'none', color: token.colorText }}>
                {formatMinute(s.minute)} – {formatMinute(s.minute + durationMinutes)}
              </div>
              <div style={{ width: COL.source, flex: 'none' }}>
                <Tag color={s.source === '加開' ? 'warning' : 'default'}>{s.source}</Tag>
              </div>
              <div style={{ width: COL.status, flex: 'none' }}>
                {s.isCancelled ? <Tag color="error">停課</Tag> : <Tag color="success">正常</Tag>}
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 12,
                }}
              >
                {!readOnly && s.source === '排程' && (
                  <Button
                    type="link"
                    size="small"
                    danger={!s.isCancelled}
                    style={{ padding: 0 }}
                    onClick={() => onToggleCancel(s.dateKey)}
                  >
                    {s.isCancelled ? '恢復' : '停課'}
                  </Button>
                )}
                {!readOnly && s.source === '加開' && (
                  <Button
                    type="link"
                    size="small"
                    danger
                    style={{ padding: 0 }}
                    onClick={() => onRemoveExtra(s.key)}
                  >
                    移除
                  </Button>
                )}
              </div>
            </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}

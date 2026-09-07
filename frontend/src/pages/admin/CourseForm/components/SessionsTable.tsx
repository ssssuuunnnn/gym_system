import type { CSSProperties } from 'react';
import { Button, DatePicker, Select, Tag, theme } from 'antd';
import dayjs from 'dayjs';
import {
  formatDateKey,
  formatMinute,
  TIME_OPTIONS,
  type Occurrence,
} from '../lib/recurrence';

export interface SessionsTableProps {
  occurrences: Occurrence[];
  durationMinutes: number;
  editingId: string | null;
  onStartEdit: (occId: string) => void;
  onDoneEdit: () => void;
  onChangeDate: (occId: string, dateKey: string) => void;
  onChangeTime: (occId: string, minute: number) => void;
  onResetOcc: (occId: string) => void;
  onRemoveOcc: (occId: string) => void;
  onClearAll: () => void;
}

const COL = {
  idx: 48,
  date: 150,
  time: 150,
  source: 110,
  actions: 176,
};

export function SessionsTable(props: SessionsTableProps) {
  const {
    occurrences,
    durationMinutes,
    editingId,
    onStartEdit,
    onDoneEdit,
    onChangeDate,
    onChangeTime,
    onResetOcc,
    onRemoveOcc,
    onClearAll,
  } = props;
  const { token } = theme.useToken();

  const headerCell: CSSProperties = { flex: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>開課時間</div>
        <Tag color="processing">{occurrences.length} 堂</Tag>
        <div style={{ flex: 1 }} />
        <Button type="link" size="small" danger onClick={onClearAll}>
          清除所有開課時間
        </Button>
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
          <div style={{ ...headerCell, width: COL.source }}>排課規則來源</div>
          <div style={{ flex: 1, minWidth: 0 }}>狀態</div>
          <div style={{ ...headerCell, width: COL.actions, textAlign: 'right' }}>操作</div>
        </div>

        {occurrences.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: token.colorTextTertiary }}>
            尚未產生任何課堂，請設定排課規則或於日曆點選時段
          </div>
        ) : (
          occurrences.map((o, i) => {
            const editing = editingId === o.occId;
            return (
              <div
                key={o.occId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 16px',
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  fontSize: 14,
                  minHeight: 44,
                }}
              >
                <div style={{ width: COL.idx, flex: 'none', color: token.colorTextQuaternary, fontSize: 13 }}>
                  {i + 1}.
                </div>

                {editing ? (
                  <>
                    <div style={{ width: COL.date, flex: 'none', paddingRight: 8 }}>
                      <DatePicker
                        size="small"
                        allowClear={false}
                        value={dayjs(o.dateKey)}
                        onChange={(d) => d && onChangeDate(o.occId, d.format('YYYY-MM-DD'))}
                        style={{ width: 138 }}
                      />
                    </div>
                    <div style={{ width: COL.time, flex: 'none', paddingRight: 8 }}>
                      <Select
                        size="small"
                        value={o.minute}
                        onChange={(v) => onChangeTime(o.occId, v)}
                        options={TIME_OPTIONS}
                        style={{ width: 110 }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ width: COL.date, flex: 'none', color: token.colorText }}>
                      {formatDateKey(o.dateKey)}
                    </div>
                    <div style={{ width: COL.time, flex: 'none', color: token.colorText }}>
                      {formatMinute(o.minute)} – {formatMinute(o.minute + durationMinutes)}
                    </div>
                  </>
                )}

                <div style={{ width: COL.source, flex: 'none' }}>
                  <Tag color={o.isExtra ? 'warning' : 'default'}>
                    {o.isExtra ? '單次加開' : `規則 ${o.rulePosition}`}
                  </Tag>
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {o.adjusted && <Tag color="warning">已調整</Tag>}
                  <span
                    style={{
                      fontSize: 13,
                      color: token.colorTextTertiary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {o.adjusted ? `原定 ${formatDateKey(o.origKey)} ${formatMinute(o.origMinute)}` : ''}
                  </span>
                </div>

                <div
                  style={{
                    width: COL.actions,
                    flex: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 8,
                  }}
                >
                  {editing ? (
                    <Button type="link" size="small" style={{ padding: 0 }} onClick={onDoneEdit}>
                      完成
                    </Button>
                  ) : (
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0 }}
                      onClick={() => onStartEdit(o.occId)}
                    >
                      改時間
                    </Button>
                  )}
                  {o.adjusted && (
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0, color: token.colorTextSecondary }}
                      onClick={() => onResetOcc(o.occId)}
                    >
                      還原
                    </Button>
                  )}
                  <Button
                    type="link"
                    size="small"
                    danger
                    style={{ padding: 0 }}
                    onClick={() => onRemoveOcc(o.occId)}
                  >
                    移除
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

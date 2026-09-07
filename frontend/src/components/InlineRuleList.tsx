import { createContext, useContext } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Button, theme } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';

/**
 * 「編號設定列表」共用外框：一個柔底面板 → 標題＋說明 → 多列帶編號晶片的設定列
 * （列內欄位由 caller 提供，列尾一顆刪除鈕）→ 一顆虛線「新增一列」按鈕。
 *
 * 目前用於公休設定「快速設定」（`Availability`）的批次關閉列；各自的欄位／摘要／行動
 * 放在 `InlineRuleRow` 的 children。日後其他「多列批次設定」需求也可共用。
 */

const RowContext = createContext<{ chipPrefix: string; readOnly: boolean }>({
  chipPrefix: '項目',
  readOnly: false,
});

export interface InlineRuleListProps {
  /** 面板標題，例如「排課規則」。 */
  title: string;
  /** 標題右側的灰字說明。 */
  description?: ReactNode;
  /** 每列編號晶片的前綴，例如「規則」→「規則 1」。 */
  chipPrefix: string;
  /** 「新增一列」按鈕文字。 */
  addLabel: string;
  onAdd: () => void;
  /** 唯讀：不顯示「新增一列」按鈕與各列的刪除鈕（caller 仍需自行 disable 列內欄位）。 */
  readOnly?: boolean;
  /** 各設定列，通常是 `InlineRuleRow` 的陣列。 */
  children: ReactNode;
  style?: CSSProperties;
}

export function InlineRuleList(props: InlineRuleListProps) {
  const { title, description, chipPrefix, addLabel, onAdd, readOnly = false, children, style } = props;
  const { token } = theme.useToken();

  return (
    <RowContext.Provider value={{ chipPrefix, readOnly }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 14,
          background: token.colorFillTertiary,
          borderRadius: token.borderRadius,
          ...style,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
          {description != null && (
            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{description}</div>
          )}
        </div>

        {children}

        {!readOnly && (
          <Button type="dashed" block icon={<PlusOutlined />} onClick={onAdd}>
            {addLabel}
          </Button>
        )}
      </div>
    </RowContext.Provider>
  );
}

export interface InlineRuleRowProps {
  /** 0 起算的列索引，晶片顯示為 `{chipPrefix} {index + 1}`。 */
  index: number;
  onRemove: () => void;
  /** caller 的欄位、摘要文字或行內行動（例如「套用」）。 */
  children: ReactNode;
  style?: CSSProperties;
}

export function InlineRuleRow(props: InlineRuleRowProps) {
  const { index, onRemove, children, style } = props;
  const { token } = theme.useToken();
  const { chipPrefix, readOnly } = useContext(RowContext);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        padding: '10px 12px',
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        ...style,
      }}
    >
      <span style={{ fontSize: 12, color: token.colorTextQuaternary, width: 44, flex: 'none' }}>
        {chipPrefix} {index + 1}
      </span>
      {children}
      <div style={{ flex: 1 }} />
      {!readOnly && (
        <Button type="text" size="small" icon={<DeleteOutlined />} onClick={onRemove} />
      )}
    </div>
  );
}

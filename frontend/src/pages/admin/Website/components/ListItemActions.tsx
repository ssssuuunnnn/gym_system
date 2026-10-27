import { Button, Space, Tooltip } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined } from '@ant-design/icons';

export interface ListItemActionsProps {
  index: number;
  count: number;
  /** 項目名稱，用在按鈕的無障礙標籤 */
  label: string;
  onMove: (direction: -1 | 1) => void;
  /** 不提供時不顯示刪除 */
  onRemove?: () => void;
}

/** 清單項目右側的「上移／下移／刪除」小按鈕（常見問題、特色、照片、教練、方案共用） */
export function ListItemActions({ index, count, label, onMove, onRemove }: ListItemActionsProps) {
  return (
    <Space size={2}>
      <Tooltip title="上移">
        <Button size="small" type="text" icon={<ArrowUpOutlined />} aria-label={`上移「${label}」`} disabled={index === 0} onClick={() => onMove(-1)} />
      </Tooltip>
      <Tooltip title="下移">
        <Button size="small" type="text" icon={<ArrowDownOutlined />} aria-label={`下移「${label}」`} disabled={index === count - 1} onClick={() => onMove(1)} />
      </Tooltip>
      {onRemove && (
        <Tooltip title="刪除">
          <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={`刪除「${label}」`} onClick={onRemove} />
        </Tooltip>
      )}
    </Space>
  );
}

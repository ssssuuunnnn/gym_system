import React from 'react';
export type SlotState = 'empty' | 'booked' | 'group' | 'buyout' | 'closed';
export interface SlotPickerProps {
  /** 回傳指定格的狀態。dayOfWeek：週一=1 … 週六=6；hour：10–21 */
  cellState: (dayOfWeek: number, hour: number) => SlotState;
  /** 點擊格子的回呼；未提供時格子不可點 */
  onCellClick?: (dayOfWeek: number, hour: number) => void;
}
export function SlotPicker(props: SlotPickerProps): JSX.Element;

import React from 'react';
export interface ProgressProps { percent: number; strokeColor?: string; size?: 'default'|'small'; showInfo?: boolean; }
export function Progress(props: ProgressProps): JSX.Element;

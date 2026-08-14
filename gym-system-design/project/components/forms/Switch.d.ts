import React from 'react';
export interface SwitchProps { checked?: boolean; onChange?: (checked: boolean) => void; disabled?: boolean; size?: 'default'|'small'; }
export function Switch(props: SwitchProps): JSX.Element;

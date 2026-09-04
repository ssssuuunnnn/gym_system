import React from 'react';
export interface CheckboxProps { checked?: boolean; onChange?: (checked: boolean) => void; disabled?: boolean; children?: React.ReactNode; }
export function Checkbox(props: CheckboxProps): JSX.Element;

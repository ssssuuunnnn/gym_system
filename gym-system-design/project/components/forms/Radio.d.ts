import React from 'react';
export interface RadioProps { checked?: boolean; onChange?: () => void; disabled?: boolean; children?: React.ReactNode; }
export function Radio(props: RadioProps): JSX.Element;

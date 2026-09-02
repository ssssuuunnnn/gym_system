import React from 'react';
export interface TagProps { color?: 'default'|'success'|'warning'|'error'|'processing'; closable?: boolean; onClose?: () => void; children?: React.ReactNode; }
export function Tag(props: TagProps): JSX.Element;

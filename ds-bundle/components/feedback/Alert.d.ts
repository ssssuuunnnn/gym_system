import React from 'react';
export interface AlertProps { type?: 'info'|'success'|'warning'|'error'; message: React.ReactNode; description?: React.ReactNode; closable?: boolean; onClose?: () => void; }
export function Alert(props: AlertProps): JSX.Element;

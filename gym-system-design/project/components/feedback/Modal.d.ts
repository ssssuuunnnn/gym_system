import React from 'react';
export interface ModalProps { open: boolean; title?: React.ReactNode; onClose?: () => void; footer?: React.ReactNode; children?: React.ReactNode; }
export function Modal(props: ModalProps): JSX.Element;

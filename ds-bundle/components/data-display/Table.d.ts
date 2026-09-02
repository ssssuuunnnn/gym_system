import React from 'react';
export interface TableColumn { key: string; title: React.ReactNode; align?: 'left'|'right'|'center'; render?: (value: any, row: any) => React.ReactNode; }
export interface TableProps { columns: TableColumn[]; data: any[]; }
export function Table(props: TableProps): JSX.Element;

import React from 'react';
export interface TabItem { key: string; label: React.ReactNode; }
export interface TabsProps { items: TabItem[]; activeKey?: string; onChange?: (key: string) => void; }
export function Tabs(props: TabsProps): JSX.Element;

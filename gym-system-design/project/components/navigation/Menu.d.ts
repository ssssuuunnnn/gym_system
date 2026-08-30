import React from 'react';
export interface MenuItem { key: string; label: React.ReactNode; icon?: string; }
export interface MenuProps { items: MenuItem[]; activeKey?: string; onChange?: (key: string) => void; collapsed?: boolean; }
export function Menu(props: MenuProps): JSX.Element;

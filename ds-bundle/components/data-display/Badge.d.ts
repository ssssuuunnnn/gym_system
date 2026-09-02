import React from 'react';
export interface BadgeProps { count?: number; dot?: boolean; color?: string; children?: React.ReactNode; }
export function Badge(props: BadgeProps): JSX.Element;

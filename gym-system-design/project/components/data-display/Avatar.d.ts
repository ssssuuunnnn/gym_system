import React from 'react';
export interface AvatarProps { src?: string; size?: number; shape?: 'circle'|'square'; children?: React.ReactNode; }
export function Avatar(props: AvatarProps): JSX.Element;

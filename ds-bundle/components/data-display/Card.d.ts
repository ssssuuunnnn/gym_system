import React from 'react';
export interface CardProps { title?: React.ReactNode; extra?: React.ReactNode; hoverable?: boolean; style?: React.CSSProperties; bodyStyle?: React.CSSProperties; children?: React.ReactNode; }
export function Card(props: CardProps): JSX.Element;

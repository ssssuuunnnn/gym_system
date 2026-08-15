import React from 'react';
export interface StatisticProps { title: React.ReactNode; value: React.ReactNode; prefix?: React.ReactNode; suffix?: React.ReactNode; valueColor?: string; trend?: number; }
export function Statistic(props: StatisticProps): JSX.Element;

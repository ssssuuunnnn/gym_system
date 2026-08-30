import React from 'react';
export interface InputProps {
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  size?: 'large'|'middle'|'small';
  disabled?: boolean;
  status?: 'error'|'warning';
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  type?: string;
  style?: React.CSSProperties;
}
export function Input(props: InputProps): JSX.Element;

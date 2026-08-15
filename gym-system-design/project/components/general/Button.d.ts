import React from 'react';
export interface ButtonProps {
  type?: 'default'|'primary'|'dashed'|'text'|'link';
  size?: 'large'|'middle'|'small';
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  block?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export function Button(props: ButtonProps): JSX.Element;

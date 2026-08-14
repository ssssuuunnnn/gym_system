import React from 'react';
const COLORS={default:['var(--fill-secondary)','var(--text-secondary)','var(--border-color)'],success:['var(--color-success-bg)','var(--color-success)','var(--color-success-border)'],
warning:['var(--color-warning-bg)','var(--color-warning)','var(--color-warning-border)'],error:['var(--color-error-bg)','var(--color-error)','var(--color-error-border)'],
processing:['var(--color-primary-bg)','var(--color-primary)','var(--color-primary-border)']};
export function Tag(props){
const {color='default',children,closable=false,onClose}=props;
const [bg,fg,bd]=COLORS[color]||COLORS.default;
return React.createElement('span',{style:{display:'inline-flex',alignItems:'center',gap:4,height:22,padding:'0 7px',fontSize:12,borderRadius:'var(--radius-sm)',
background:bg,color:fg,border:`1px solid ${bd}`,fontFamily:'var(--font-family)',lineHeight:'20px'}},children,
closable&&React.createElement('i',{className:'ri-close-line',onClick:onClose,style:{cursor:'pointer',fontSize:10}}));
}

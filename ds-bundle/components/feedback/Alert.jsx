import React from 'react';
const MAP={info:['var(--color-primary-bg)','var(--color-primary-border)','var(--color-primary)','ri-information-line'],
success:['var(--color-success-bg)','var(--color-success-border)','var(--color-success)','ri-checkbox-circle-line'],
warning:['var(--color-warning-bg)','var(--color-warning-border)','var(--color-warning)','ri-alert-line'],
error:['var(--color-error-bg)','var(--color-error-border)','var(--color-error)','ri-close-circle-line']};
export function Alert(props){
const {type='info',message,description,closable=false,onClose}=props;
const [bg,bd,fg,icon]=MAP[type]||MAP.info;
return React.createElement('div',{style:{display:'flex',gap:10,alignItems:description?'flex-start':'center',padding:'10px 14px',borderRadius:'var(--radius-base)',
background:bg,border:`1px solid ${bd}`,fontFamily:'var(--font-family)'}},
React.createElement('i',{className:icon,style:{color:fg,fontSize:16,marginTop:description?2:0}}),
React.createElement('div',{style:{flex:1}},React.createElement('div',{style:{fontSize:14,color:'var(--text-primary)',fontWeight:description?600:400}},message),
description&&React.createElement('div',{style:{fontSize:13,color:'var(--text-secondary)',marginTop:4}},description)),
closable&&React.createElement('i',{className:'ri-close-line',onClick:onClose,style:{cursor:'pointer',color:'var(--text-tertiary)'}}));
}

import React from 'react';
export function Checkbox(props){
const {checked=false,onChange,disabled=false,children}=props;
return React.createElement('label',{style:{display:'inline-flex',alignItems:'center',gap:8,cursor:disabled?'not-allowed':'pointer',fontFamily:'var(--font-family)',fontSize:14,color:disabled?'var(--text-quaternary)':'var(--text-primary)'}},
React.createElement('span',{onClick:()=>!disabled&&onChange&&onChange(!checked),
style:{width:16,height:16,borderRadius:4,border:`1px solid ${checked?'var(--color-primary)':'var(--border-color)'}`,background:checked?'var(--color-primary)':'#fff',
display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .2s'}},
checked&&React.createElement('i',{className:'ri-check-line',style:{color:'#fff',fontSize:12}})),
children);
}

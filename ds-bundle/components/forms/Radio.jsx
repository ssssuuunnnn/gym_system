import React from 'react';
export function Radio(props){
const {checked=false,onChange,disabled=false,children}=props;
return React.createElement('label',{style:{display:'inline-flex',alignItems:'center',gap:8,cursor:disabled?'not-allowed':'pointer',fontFamily:'var(--font-family)',fontSize:14,color:disabled?'var(--text-quaternary)':'var(--text-primary)'}},
React.createElement('span',{onClick:()=>!disabled&&onChange&&onChange(),
style:{width:16,height:16,borderRadius:'50%',border:`1px solid ${checked?'var(--color-primary)':'var(--border-color)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}},
checked&&React.createElement('span',{style:{width:8,height:8,borderRadius:'50%',background:'var(--color-primary)'}})),
children);
}

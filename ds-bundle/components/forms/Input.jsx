import React from 'react';
export function Input(props){
const {placeholder='',value,onChange,size='middle',disabled=false,status,prefix,suffix,type='text'}=props;
const [focus,setFocus]=React.useState(false);
const h=size==='large'?40:size==='small'?24:32;
let border='var(--border-color)';
if(status==='error')border='var(--color-error)';else if(status==='warning')border='var(--color-warning)';
if(focus)border=status==='error'?'var(--color-error)':'var(--color-primary)';
return React.createElement('div',{style:{display:'inline-flex',alignItems:'center',gap:4,height:h,padding:'0 11px',borderRadius:'var(--radius-base)',
border:`1px solid ${border}`,background:disabled?'var(--fill-tertiary)':'var(--bg-container)',boxShadow:focus?'0 0 0 2px var(--color-primary-bg)':'none',
transition:'all .2s',fontFamily:'var(--font-family)',width:props.style?.width||220}},
prefix&&React.createElement('span',{style:{color:'var(--text-tertiary)',display:'flex'}},prefix),
React.createElement('input',{type,placeholder,value,onChange,disabled,
style:{border:'none',outline:'none',flex:1,fontSize:14,color:'var(--text-primary)',background:'transparent',fontFamily:'var(--font-family)'},
onFocus:()=>setFocus(true),onBlur:()=>setFocus(false)}),
suffix&&React.createElement('span',{style:{color:'var(--text-tertiary)',display:'flex'}},suffix));
}

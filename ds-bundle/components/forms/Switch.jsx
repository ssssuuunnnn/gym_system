import React from 'react';
export function Switch(props){
const {checked=false,onChange,disabled=false,size='default'}=props;
const w=size==='small'?28:44,h=size==='small'?16:22;
return React.createElement('span',{onClick:()=>!disabled&&onChange&&onChange(!checked),
style:{width:w,height:h,borderRadius:h,background:disabled?'var(--fill-tertiary)':checked?'var(--color-primary)':'rgba(0,0,0,0.25)',position:'relative',display:'inline-block',cursor:disabled?'not-allowed':'pointer',transition:'background .2s'}},
React.createElement('span',{style:{width:h-4,height:h-4,borderRadius:'50%',background:'#fff',position:'absolute',top:2,left:checked?w-h+2:2,transition:'left .2s',boxShadow:'0 2px 4px rgba(0,0,0,0.2)'}}));
}

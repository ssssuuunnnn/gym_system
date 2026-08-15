import React from 'react';
export function Select(props){
const {options=[],value,placeholder='請選擇',onChange,size='middle',disabled=false,style}=props;
const [open,setOpen]=React.useState(false);
const h=size==='large'?40:size==='small'?24:32;
const selected=options.find(o=>o.value===value);
return React.createElement('div',{style:{position:'relative',width:style?.width||180,fontFamily:'var(--font-family)'}},
React.createElement('div',{onClick:()=>!disabled&&setOpen(!open),
style:{display:'flex',alignItems:'center',justifyContent:'space-between',height:h,padding:'0 11px',borderRadius:'var(--radius-base)',
border:`1px solid ${open?'var(--color-primary)':'var(--border-color)'}`,background:disabled?'var(--fill-tertiary)':'var(--bg-container)',
cursor:disabled?'not-allowed':'pointer',boxShadow:open?'0 0 0 2px var(--color-primary-bg)':'none',fontSize:14}},
React.createElement('span',{style:{color:selected?'var(--text-primary)':'var(--text-quaternary)'}},selected?selected.label:placeholder),
React.createElement('i',{className:'ri-arrow-down-s-line',style:{color:'var(--text-tertiary)',transform:open?'rotate(180deg)':'none',transition:'transform .2s'}})),
open&&React.createElement('div',{style:{position:'absolute',top:h+4,left:0,right:0,background:'#fff',borderRadius:'var(--radius-base)',boxShadow:'var(--shadow-2)',zIndex:10,padding:4}},
options.map(o=>React.createElement('div',{key:o.value,onClick:()=>{onChange&&onChange(o.value);setOpen(false);},
style:{padding:'5px 12px',borderRadius:'var(--radius-sm)',fontSize:14,cursor:'pointer',background:o.value===value?'var(--color-primary-bg)':'transparent',color:o.value===value?'var(--color-primary)':'var(--text-primary)'}},o.label))));
}

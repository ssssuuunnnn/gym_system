import React from 'react';
const SIZE={large:{h:40,fs:16,px:15},middle:{h:32,fs:14,px:15},small:{h:24,fs:14,px:7}};
export function Button(props){
const {type='default',size='middle',danger=false,disabled=false,loading=false,icon=null,block=false,children,onClick,style}=props;
const s=SIZE[size]||SIZE.middle;
const [hover,setHover]=React.useState(false);
const [active,setActive]=React.useState(false);
let bg='var(--bg-container)',color='var(--text-primary)',border='1px solid var(--border-color)';
if(type==='primary'){bg=danger?'var(--color-error)':'var(--color-primary)';color='#fff';border='1px solid transparent';}
else if(type==='dashed'){border='1px dashed var(--border-color)';}
else if(type==='text'){border='1px solid transparent';bg='transparent';}
else if(type==='link'){border='1px solid transparent';bg='transparent';color=danger?'var(--color-error)':'var(--color-primary)';}
if(danger&&type!=='primary'){color='var(--color-error)';border=type==='default'||type==='dashed'?'1px solid var(--color-error-border)':border;}
if(hover&&!disabled){
if(type==='primary'){bg=danger?'var(--color-error-hover)':'var(--color-primary-hover)';}
else if(type==='default'||type==='dashed'){color=danger?'var(--color-error-hover)':'var(--color-primary-hover)';border=`1px ${type==='dashed'?'dashed':'solid'} ${danger?'var(--color-error-hover)':'var(--color-primary-border)'}`;}
else if(type==='text'){bg='var(--fill-tertiary)';}
else if(type==='link'){color='var(--color-primary-hover)';}
}
if(active&&!disabled&&type==='primary'){bg=danger?'var(--red-6)':'var(--color-primary-active)';}
if(disabled){bg=type==='primary'?'var(--fill-primary)':'var(--bg-container)';color='var(--text-quaternary)';border='1px solid var(--border-secondary)';}
return React.createElement('button',{
onMouseEnter:()=>setHover(true),onMouseLeave:()=>{setHover(false);setActive(false);},
onMouseDown:()=>setActive(true),onMouseUp:()=>setActive(false),
disabled:disabled||loading,onClick,
style:{display:block?'flex':'inline-flex',width:block?'100%':undefined,alignItems:'center',justifyContent:'center',gap:6,
height:s.h,fontSize:s.fs,padding:`0 ${s.px}px`,borderRadius:'var(--radius-base)',background:bg,color,border,
fontFamily:'var(--font-family)',fontWeight:400,cursor:disabled?'not-allowed':'pointer',transition:'all .2s',
boxShadow:type==='primary'&&!disabled&&!danger?'0 2px 0 rgba(5,145,255,0.1)':undefined,textDecoration:type==='link'&&hover?'underline':'none',...style}
},loading?React.createElement('span',{style:{width:14,height:14,borderRadius:'50%',border:'2px solid currentColor',borderTopColor:'transparent',display:'inline-block',animation:'spin .8s linear infinite'}}):icon,children&&React.createElement('span',null,children));
}

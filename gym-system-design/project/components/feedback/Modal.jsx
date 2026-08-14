import React from 'react';
export function Modal(props){
const {open,title,children,onClose,footer}=props;
if(!open)return null;
return React.createElement('div',{style:{position:'fixed',inset:0,background:'var(--bg-mask)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,fontFamily:'var(--font-family)'},onClick:onClose},
React.createElement('div',{onClick:e=>e.stopPropagation(),style:{width:420,background:'#fff',borderRadius:'var(--radius-lg)',boxShadow:'var(--shadow-2)',overflow:'hidden'}},
React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid var(--border-secondary)'}},
React.createElement('span',{style:{fontSize:16,fontWeight:600}},title),
React.createElement('i',{className:'ri-close-line',onClick:onClose,style:{cursor:'pointer',color:'var(--text-tertiary)'}})),
React.createElement('div',{style:{padding:24,fontSize:14,color:'var(--text-secondary)'}},children),
footer&&React.createElement('div',{style:{padding:'12px 24px',borderTop:'1px solid var(--border-secondary)',display:'flex',justifyContent:'flex-end',gap:8}},footer)));
}

import React from 'react';
export function Card(props){
const {title,extra,children,hoverable=false,style,bodyStyle}=props;
const [hover,setHover]=React.useState(false);
return React.createElement('div',{onMouseEnter:()=>setHover(true),onMouseLeave:()=>setHover(false),
style:{background:'var(--bg-container)',borderRadius:'var(--radius-lg)',border:'1px solid var(--border-secondary)',
boxShadow:hoverable&&hover?'var(--shadow-card-hover)':'none',transition:'box-shadow .2s',overflow:'hidden',fontFamily:'var(--font-family)',...style}},
title&&React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',height:48,borderBottom:'1px solid var(--border-secondary)'}},
React.createElement('span',{style:{fontSize:16,fontWeight:600,color:'var(--text-primary)'}},title),
extra&&React.createElement('span',{style:{fontSize:14,color:'var(--text-secondary)'}},extra)),
React.createElement('div',{style:{padding:20,...bodyStyle}},children));
}

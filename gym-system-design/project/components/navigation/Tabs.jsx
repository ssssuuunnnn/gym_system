import React from 'react';
export function Tabs(props){
const {items=[],activeKey,onChange}=props;
return React.createElement('div',{style:{borderBottom:'1px solid var(--border-secondary)',display:'flex',gap:32,fontFamily:'var(--font-family)'}},
items.map(it=>React.createElement('div',{key:it.key,onClick:()=>onChange&&onChange(it.key),
style:{padding:'12px 0',fontSize:14,cursor:'pointer',color:it.key===activeKey?'var(--color-primary)':'var(--text-primary)',
fontWeight:it.key===activeKey?600:400,borderBottom:it.key===activeKey?'2px solid var(--color-primary)':'2px solid transparent',marginBottom:-1}},it.label)));
}

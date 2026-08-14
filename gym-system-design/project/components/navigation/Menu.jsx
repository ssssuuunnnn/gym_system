import React from 'react';
export function Menu(props){
const {items=[],activeKey,onChange,collapsed=false}=props;
return React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:4,fontFamily:'var(--font-family)',padding:8}},
items.map(it=>React.createElement('div',{key:it.key,onClick:()=>onChange&&onChange(it.key),title:collapsed?it.label:undefined,
style:{display:'flex',alignItems:'center',justifyContent:collapsed?'center':'flex-start',gap:10,height:40,padding:collapsed?0:'0 16px',borderRadius:'var(--radius-base)',cursor:'pointer',fontSize:14,
background:it.key===activeKey?'var(--color-primary-bg)':'transparent',color:it.key===activeKey?'var(--color-primary)':'var(--text-primary)',fontWeight:it.key===activeKey?500:400}},
it.icon&&React.createElement('i',{className:it.icon,style:{fontSize:16}}),!collapsed&&it.label)));
}

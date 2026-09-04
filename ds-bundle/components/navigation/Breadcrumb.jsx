import React from 'react';
export function Breadcrumb(props){
const {items=[]}=props;
return React.createElement('div',{style:{display:'flex',alignItems:'center',gap:8,fontSize:14,fontFamily:'var(--font-family)'}},
items.map((it,i)=>React.createElement(React.Fragment,{key:i},
i>0&&React.createElement('span',{style:{color:'var(--text-quaternary)'}},'/'),
React.createElement('span',{style:{color:i===items.length-1?'var(--text-primary)':'var(--text-tertiary)'}},it))));
}

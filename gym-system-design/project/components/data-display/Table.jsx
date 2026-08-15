import React from 'react';
export function Table(props){
const {columns=[],data=[]}=props;
return React.createElement('table',{style:{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-family)',fontSize:14}},
React.createElement('thead',null,React.createElement('tr',null,columns.map(c=>React.createElement('th',{key:c.key,
style:{textAlign:c.align||'left',padding:'12px 16px',background:'var(--gray-2)',color:'var(--text-secondary)',fontWeight:600,fontSize:13,borderBottom:'1px solid var(--border-secondary)'}},c.title)))),
React.createElement('tbody',null,data.map((row,i)=>React.createElement('tr',{key:i,style:{borderBottom:'1px solid var(--border-secondary)'}},
columns.map(c=>React.createElement('td',{key:c.key,style:{padding:'12px 16px',textAlign:c.align||'left',color:'var(--text-primary)'}},c.render?c.render(row[c.key],row):row[c.key]))))));
}

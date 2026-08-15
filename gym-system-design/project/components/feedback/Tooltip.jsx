import React from 'react';
export function Tooltip(props){
const {content,children}=props;
const [show,setShow]=React.useState(false);
return React.createElement('span',{style:{position:'relative',display:'inline-flex'},onMouseEnter:()=>setShow(true),onMouseLeave:()=>setShow(false)},
children,show&&React.createElement('span',{style:{position:'absolute',bottom:'calc(100% + 6px)',left:'50%',transform:'translateX(-50%)',
background:'var(--bg-spotlight)',color:'#fff',fontSize:12,padding:'6px 10px',borderRadius:'var(--radius-sm)',whiteSpace:'nowrap',fontFamily:'var(--font-family)',zIndex:100}},content));
}

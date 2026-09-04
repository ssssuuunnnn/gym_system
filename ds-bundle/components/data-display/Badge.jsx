import React from 'react';
export function Badge(props){
const {count,dot=false,color='var(--color-error)',children}=props;
if(!children){
return React.createElement('span',{style:{display:'inline-block',width:8,height:8,borderRadius:'50%',background:color}});
}
return React.createElement('span',{style:{position:'relative',display:'inline-flex'}},children,
(count>0||dot)&&React.createElement('span',{style:{position:'absolute',top:-4,right:-4,minWidth:dot?8:16,height:dot?8:16,borderRadius:8,background:color,
color:'#fff',fontSize:11,lineHeight:dot?'8px':'16px',textAlign:'center',padding:dot?0:'0 4px',fontFamily:'var(--font-family)',boxShadow:'0 0 0 1px #fff'}},dot?null:count));
}

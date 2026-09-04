import React from 'react';
export function Avatar(props){
const {src,children,size=32,shape='circle'}=props;
const style={width:size,height:size,borderRadius:shape==='circle'?'50%':'var(--radius-sm)',background:'var(--color-primary)',color:'#fff',
display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:size*0.4,fontFamily:'var(--font-family)',overflow:'hidden',flexShrink:0};
if(src)return React.createElement('img',{src,style});
return React.createElement('span',{style},children);
}

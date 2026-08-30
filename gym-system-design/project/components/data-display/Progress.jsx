import React from 'react';
export function Progress(props){
const {percent=0,strokeColor='var(--color-primary)',size='default',showInfo=true}=props;
const h=size==='small'?6:8;
return React.createElement('div',{style:{display:'flex',alignItems:'center',gap:8,fontFamily:'var(--font-family)'}},
React.createElement('div',{style:{flex:1,height:h,borderRadius:h,background:'var(--fill-secondary)',overflow:'hidden'}},
React.createElement('div',{style:{width:percent+'%',height:'100%',borderRadius:h,background:strokeColor,transition:'width .3s'}})),
showInfo&&React.createElement('span',{style:{fontSize:13,color:'var(--text-secondary)',minWidth:36,textAlign:'right'}},percent+'%'));
}

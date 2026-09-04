import React from 'react';
export function Statistic(props){
const {title,value,prefix,suffix,valueColor,trend}=props;
return React.createElement('div',{style:{fontFamily:'var(--font-family)'}},
React.createElement('div',{style:{fontSize:14,color:'var(--text-secondary)',marginBottom:4}},title),
React.createElement('div',{style:{display:'flex',alignItems:'baseline',gap:6}},
React.createElement('span',{style:{fontSize:24,fontWeight:600,color:valueColor||'var(--text-primary)'}},prefix,value,suffix),
trend&&React.createElement('span',{style:{fontSize:12,color:trend>0?'var(--color-success)':'var(--color-error)',display:'flex',alignItems:'center'}},
React.createElement('i',{className:trend>0?'ri-arrow-up-line':'ri-arrow-down-line'}),Math.abs(trend)+'%')));
}

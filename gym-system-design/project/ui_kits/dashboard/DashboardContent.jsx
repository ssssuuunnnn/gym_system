const DATA={
today:{label:'今日',revLabel:'今日營收',rev:'32,480',revTrend:5.2,memberLabel:'今日新增會員',member:'6',memberTrend:20,
chart:{labels:['06','08','10','12','14','16','18','20','22'],values:[4,9,14,22,18,26,34,30,12]}},
week:{label:'本週',revLabel:'本週營收',rev:'168,900',revTrend:8.3,memberLabel:'本週新增會員',member:'18',memberTrend:12,
chart:{labels:['一','二','三','四','五','六','日'],values:[22,26,24,30,28,36,32]}},
month:{label:'本月',revLabel:'本月營收',rev:'386,240',revTrend:12.4,memberLabel:'本月新增會員',member:'42',memberTrend:8.1,
chart:{labels:['第1週','第2週','第3週','第4週'],values:[82,95,88,121]}},
year:{label:'本年',revLabel:'本年營收',rev:'4,280,600',revTrend:15.6,memberLabel:'本年新增會員',member:'386',memberTrend:9.4,
chart:{labels:['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],values:[38,42,35,50,46,58,54,62,59,68,64,72]}}};
const classShare=[{label:'場地租借',pct:35,color:'var(--chart-1)'},{label:'私人教練課',pct:25,color:'var(--chart-2)'},{label:'場地包場',pct:20,color:'var(--chart-3)'},{label:'團體課程',pct:20,color:'var(--chart-4)'}];
const LIVE={
'2F':[{type:'團體課程',name:'活力瑜伽',room:'Bella',time:'10:00–11:00',status:'進行中'},
{type:'私人教練課',name:'Helen教練 × 林同學',room:'一對二',time:'11:00–12:00',status:'進行中'},
{type:'場地租借',name:'Darren',room:'一對多',time:'13:00–14:00',status:'已預約'},
{type:'場地包場',name:'Zero',room:'',time:'15:00–17:00',status:'已預約'}],
'1F':[{type:'私人教練課',name:'林教練 × 王同學',room:'一對一',time:'10:30–11:30',status:'進行中'},
{type:'場地租借',name:'Helen',room:'一對一',time:'14:00–15:00',status:'已預約'}]};
const STATUS_TAG={'進行中':'success','已預約':'processing'};
const PENDING_RENTALS=[
{who:'張先生',venue:'場地租借',date:'8/17 (日) 09:00–10:00',submitted:'今日 13:20'},
{who:'林先生',venue:'場地租借',date:'8/14 (今日) 18:00–19:00',submitted:'今日 11:02'},
{who:'陳小姐',venue:'場地包場',date:'8/20 (三) 全天',submitted:'今日 10:35'},
{who:'王先生',venue:'場地租借',date:'8/16 (六) 14:00–15:00',submitted:'今日 09:12'}];
const E=React.createElement;
function DashboardContent({range}){
const {Card,Statistic,Tag}=window.PulseFitDesignSystem_325e30;
const d=DATA[range]||DATA.today;
const max=Math.max(...d.chart.values);
let acc=0;
const conic=classShare.map(s=>{const start=acc;acc+=s.pct;return `${s.color} ${start}% ${acc}%`;}).join(',');

const statRow=E('div',{style:{display:'flex',gap:16}},
E(Card,{style:{flex:1}},E(Statistic,{title:d.revLabel,value:d.rev,prefix:'NT$ ',trend:d.revTrend})),
E(Card,{style:{flex:1}},E(Statistic,{title:d.memberLabel,value:d.member,suffix:' 人',trend:d.memberTrend})));

const bars=E('div',{style:{display:'flex',alignItems:'flex-end',gap:8,height:160,marginTop:12}},
d.chart.values.map((v,i)=>E('div',{key:i,style:{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6}},
E('div',{style:{width:'100%',height:(v/max*130)+'px',background:i===d.chart.values.length-1?'var(--color-primary)':'var(--color-primary-bg)',borderRadius:'4px 4px 0 0'}}),
E('span',{style:{fontSize:11,color:'var(--text-tertiary)'}},d.chart.labels[i]))));

const revenueCard=E(Card,{style:{flex:2},title:'營收趨勢',extra:E('span',{style:{fontSize:13,color:'var(--text-tertiary)'}},d.label)},bars);

const legend=E('div',{style:{display:'flex',flexDirection:'column',gap:8,width:'100%'}},
classShare.map(s=>E('div',{key:s.label,style:{display:'flex',alignItems:'center',gap:8,fontSize:13}},
E('span',{style:{width:8,height:8,borderRadius:'50%',background:s.color}}),
E('span',{style:{flex:1,color:'var(--text-secondary)'}},s.label),
E('span',{style:{color:'var(--text-primary)',fontWeight:500}},s.pct+'%'))));

const donut=E('div',{style:{width:120,height:120,borderRadius:'50%',background:`conic-gradient(${conic})`,display:'flex',alignItems:'center',justifyContent:'center'}},
E('div',{style:{width:70,height:70,borderRadius:'50%',background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'var(--text-secondary)',flexDirection:'column'}},
E('span',{style:{fontSize:18,fontWeight:600,color:'var(--text-primary)'}},'312'),E('span',null,'總課程數')));

const shareCard=E(Card,{style:{flex:1},title:'課程類型佔比'},E('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:16}},donut,legend));

const chartRow=E('div',{style:{display:'flex',gap:16,alignItems:'stretch'}},revenueCard,shareCard);

function floorList(items){
return E('div',{style:{display:'flex',flexDirection:'column',gap:10}},
items.map((it,i)=>E('div',{key:i,style:{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:i<items.length-1?'1px solid var(--border-secondary)':'none'}},
E(Tag,{color:'default'},it.type),
E('div',{style:{flex:1,minWidth:0}},
E('div',{style:{fontSize:14,color:'var(--text-primary)',fontWeight:500}},it.name),
E('div',{style:{fontSize:12,color:'var(--text-tertiary)'}},(it.room?it.room+' · ':'')+it.time)),
E(Tag,{color:STATUS_TAG[it.status]},it.status))));
}

const liveCard=E(Card,{style:{flex:2},title:'即時課程',extra:E('a',{href:'#'},'查看場地時段表')},
E('div',{style:{display:'flex',gap:24}},
E('div',{style:{flex:3,minWidth:0}},
E('div',{style:{fontSize:13,fontWeight:600,color:'var(--text-secondary)',marginBottom:8}},'二樓'),
floorList(LIVE['2F'])),
E('div',{style:{width:1,background:'var(--border-secondary)'}}),
E('div',{style:{flex:2,minWidth:0}},
E('div',{style:{fontSize:13,fontWeight:600,color:'var(--text-secondary)',marginBottom:8}},'一樓'),
floorList(LIVE['1F']))));

const todoList=E('div',{style:{display:'flex',flexDirection:'column',gap:12}},
PENDING_RENTALS.map((it,i)=>E('div',{key:i,style:{paddingBottom:12,borderBottom:'1px solid var(--border-secondary)'}},
E('div',{style:{fontSize:14,color:'var(--text-primary)',fontWeight:500,marginBottom:4}},it.who+' · '+it.venue),
E('div',{style:{fontSize:12,color:'var(--text-tertiary)'}},'租借時段 '+it.date+' · 提交於 '+it.submitted))),
E('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:4}},
E('span',{style:{fontSize:13,color:'var(--text-secondary)'}},'待審核共 '+PENDING_RENTALS.length+' 筆'),
E('a',{href:'#'},'查看預約審核列表')));

const todoCard=E(Card,{style:{flex:1},title:'今日待辦事項'},todoList);

const bottomRow=E('div',{style:{display:'flex',gap:16,alignItems:'flex-start'}},
E('div',{id:'live-courses-card',style:{flex:2}},liveCard),
E('div',{id:'today-todo-card',style:{flex:1}},todoCard));

return E('div',{style:{display:'flex',flexDirection:'column',gap:16}},statRow,bottomRow,chartRow);
}
window.PulseFitUIKit=Object.assign(window.PulseFitUIKit||{},{DashboardContent});

function DashboardLayout({active,onNav,children}){
const {Menu,Avatar,Input,Badge}=window.PulseFitDesignSystem_325e30;
const [scrolled,setScrolled]=React.useState(false);
const [collapsed,setCollapsed]=React.useState(false);
const items=[{key:'dash',label:'儀表板',icon:'ri-dashboard-line'},{key:'member',label:'會員管理',icon:'ri-team-line'},
{key:'class',label:'課程排程',icon:'ri-calendar-line'},{key:'coach',label:'教練管理',icon:'ri-user-star-line'},
{key:'finance',label:'財務報表',icon:'ri-bar-chart-2-line'},{key:'settings',label:'系統設定',icon:'ri-settings-3-line'}];
const siderW=collapsed?'var(--layout-sider-collapsed-width)':'var(--layout-sider-width)';
const headerH=64;
return React.createElement('div',{style:{display:'flex',height:'100vh',background:'var(--bg-layout)',fontFamily:'var(--font-family)',overflow:'hidden'}},
React.createElement('div',{style:{width:siderW,height:'100vh',background:'var(--sider-bg)',borderRight:'1px solid var(--sider-border)',display:'flex',flexDirection:'column',flexShrink:0,transition:'width .2s'}},
React.createElement('div',{style:{height:'var(--layout-header-height)',display:'flex',alignItems:'center',gap:10,padding:collapsed?'0':'0 20px',justifyContent:collapsed?'center':'flex-start',flexShrink:0}},
React.createElement('div',{style:{width:28,height:28,borderRadius:'var(--radius-sm)',background:'var(--color-primary)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,flexShrink:0}},'P'),
!collapsed&&React.createElement('span',{style:{fontSize:16,fontWeight:600,color:'var(--text-primary)',whiteSpace:'nowrap'}},'PulseFit')),
React.createElement('div',{style:{flex:1,overflow:'hidden'}},React.createElement(Menu,{items,activeKey:active,onChange:onNav,collapsed})),
React.createElement('div',{onClick:()=>setCollapsed(!collapsed),style:{height:44,display:'flex',alignItems:'center',justifyContent:'center',borderTop:'1px solid var(--border-secondary)',cursor:'pointer',color:'var(--text-tertiary)',flexShrink:0}},
React.createElement('i',{className:collapsed?'ri-menu-unfold-line':'ri-menu-fold-line',style:{fontSize:16}}))),
React.createElement('div',{style:{flex:1,position:'relative',minWidth:0,height:'100vh'}},
React.createElement('div',{style:{position:'absolute',top:0,left:0,right:0,height:headerH,background:scrolled?'rgba(255,255,255,0.45)':'var(--header-bg)',backdropFilter:scrolled?'blur(18px) saturate(180%)':'none',
WebkitBackdropFilter:scrolled?'blur(18px) saturate(180%)':'none',boxShadow:scrolled?'var(--shadow-header)':'none',borderBottom:scrolled?'1px solid rgba(255,255,255,0.3)':'1px solid transparent',
display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',zIndex:10,transition:'background .25s, box-shadow .25s'}},
React.createElement(Input,{placeholder:'搜尋會員姓名或電話',prefix:React.createElement('i',{className:'ri-search-line'}),style:{width:280}}),
React.createElement('div',{style:{display:'flex',alignItems:'center',gap:20}},
React.createElement(Badge,{count:3},React.createElement('i',{className:'ri-notification-line',style:{fontSize:18,color:'var(--text-secondary)'}})),
React.createElement('div',{style:{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}},React.createElement(Avatar,{size:28},'王'),
React.createElement('span',{style:{fontSize:14,color:'var(--text-primary)'}},'王教練'),React.createElement('i',{className:'ri-arrow-down-s-line',style:{color:'var(--text-tertiary)'}})))),
React.createElement('div',{onScroll:e=>setScrolled(e.target.scrollTop>4),style:{position:'absolute',inset:0,overflowY:'auto',padding:`calc(${headerH}px + var(--layout-content-padding)) var(--layout-content-padding) var(--layout-content-padding)`}},children)));
}
window.PulseFitUIKit=Object.assign(window.PulseFitUIKit||{},{DashboardLayout});

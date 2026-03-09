function IconCartelera({ active }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={active?"#fff":"rgba(255,255,255,0.45)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={active?"rgba(255,255,255,0.08)":"none"}/><polyline points="9,22 9,12 15,12 15,22" stroke={active?"#fff":"rgba(255,255,255,0.45)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconAmigos({ active }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 110 8 4 4 0 010-8z" stroke={active?"#fff":"rgba(255,255,255,0.45)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconPerfil({ active }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" stroke={active?"#fff":"rgba(255,255,255,0.45)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

const NAV = [
  { id: "cartelera", Icon: IconCartelera },
  { id: "amigos", Icon: IconAmigos },
  { id: "perfil", Icon: IconPerfil },
]

export default function BottomNav({ tab, onTabChange, badge }) {
  return (
    <div style={{
      position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
      width:"100%", maxWidth:430, zIndex:100,
      background:"rgba(0,0,0,0.85)",
      backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
      borderTop:"1px solid rgba(255,255,255,0.06)",
      display:"flex", justifyContent:"space-around", alignItems:"center",
      paddingBottom:"env(safe-area-inset-bottom,0px)",
      height:56,
    }}>
      {NAV.map(({ id, Icon }) => {
        const isActive = tab === id
        const badgeCount = id === "amigos" ? (badge || 0) : 0
        return (
          <button key={id} onClick={() => onTabChange(id)} style={{
            flex:1, display:"flex", alignItems:"center", justifyContent:"center",
            height:"100%",
            background:"none", border:"none", cursor:"pointer",
            fontFamily:"inherit", position:"relative",
            transition:"opacity 0.2s",
            opacity: isActive ? 1 : 0.7,
          }}>
            <Icon active={isActive} />
            {badgeCount > 0 && (
              <div style={{
                position:"absolute", top:10, right:"calc(50% - 16px)",
                minWidth:16, height:16, borderRadius:8,
                background:"#ff453a",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:9, fontWeight:800, color:"#fff", padding:"0 4px",
              }}>
                {badgeCount}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

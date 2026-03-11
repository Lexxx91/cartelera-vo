function IconCartelera({ active }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={active?"#fff":"rgba(255,255,255,0.45)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={active?"rgba(255,255,255,0.08)":"none"}/><polyline points="9,22 9,12 15,12 15,22" stroke={active?"#fff":"rgba(255,255,255,0.45)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconPlanes({ active }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={active?"#fff":"rgba(255,255,255,0.45)"} strokeWidth="1.5" fill={active?"rgba(255,255,255,0.08)":"none"}/><path d="M12 8v4l3 3" stroke={active?"#fff":"rgba(255,255,255,0.45)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconSquad({ active }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 110 8 4 4 0 010-8z" stroke={active?"#fff":"rgba(255,255,255,0.45)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

const NAV = [
  { id: "cartelera", Icon: IconCartelera, label: "Cartelera" },
  { id: "planes", Icon: IconPlanes, label: "Planes" },
  { id: "squad", Icon: IconSquad, label: "Squad" },
]

export default function BottomNav({ tab, onTabChange, planesBadge, squadBadge }) {
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
      {NAV.map(({ id, Icon, label }) => {
        const isActive = tab === id
        const hasDot = (id === "planes" && planesBadge > 0) || (id === "squad" && squadBadge > 0)
        return (
          <button key={id} onClick={() => onTabChange(id)} style={{
            flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            gap:2,
            height:"100%",
            background:"none", border:"none", cursor:"pointer",
            fontFamily:"inherit", position:"relative",
            transition:"opacity 0.2s",
            opacity: isActive ? 1 : 0.7,
          }}>
            <div style={{position:"relative"}}>
              <Icon active={isActive} />
              {hasDot && (
                <div style={{
                  position:"absolute", top:-2, right:-4,
                  width:8, height:8, borderRadius:4,
                  background:"#ff453a",
                  border:"2px solid rgba(0,0,0,0.85)",
                }} />
              )}
            </div>
            <span style={{
              fontSize:9,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? "#fff" : "rgba(255,255,255,0.4)",
              letterSpacing:"0.02em",
              textTransform:"uppercase",
              fontFamily:"'Archivo Black',sans-serif",
            }}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

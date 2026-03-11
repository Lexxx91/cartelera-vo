/**
 * FriendRow — Shows friend with social stats (movies watched, cinema together, compatibility)
 */
export default function FriendRow({ friend, cinemaTogether, compatibility, onClick }) {
  const name = friend.nombre_display || friend.nombre || "Usuario"
  const watched = friend.watched_count || 0

  return (
    <div onClick={onClick} style={{
      display:"flex",alignItems:"center",gap:12,
      background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
      borderRadius:14,padding:"12px 14px",cursor:"pointer",transition:"all 0.2s",
    }}>
      {/* Avatar */}
      <div style={{
        width:48,height:48,borderRadius:"50%",overflow:"hidden",flexShrink:0,
        background:"linear-gradient(135deg,#1a1a1a,#111)",
        display:"flex",alignItems:"center",justifyContent:"center",
        border:"2px solid rgba(255,255,255,0.08)",
      }}>
        {friend.avatar_url
          ? <img src={friend.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
          : <span style={{fontSize:18,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{name.charAt(0)}</span>
        }
      </div>

      {/* Info */}
      <div style={{flex:1,minWidth:0}}>
        <p style={{margin:"0 0 4px",fontSize:15,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {name}
        </p>
        <div style={{display:"flex",flexWrap:"wrap",gap:"2px 10px"}}>
          {watched > 0 && (
            <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>
              {watched} pelis vistas
            </span>
          )}
          {cinemaTogether > 0 ? (
            <span style={{fontSize:11,color:"rgba(201,168,76,0.7)"}}>
              {cinemaTogether} {cinemaTogether === 1 ? "vez juntos" : "veces juntos"}
            </span>
          ) : (
            <span style={{fontSize:11,color:"rgba(255,255,255,0.2)",fontStyle:"italic"}}>
              Sin cine juntos aún
            </span>
          )}
          {compatibility !== null && compatibility !== undefined ? (
            <span style={{fontSize:11,fontWeight:600,color: compatibility >= 70 ? "rgba(52,199,89,0.8)" : compatibility >= 40 ? "rgba(201,168,76,0.8)" : "rgba(255,59,59,0.6)"}}>
              {compatibility}% compatibles
            </span>
          ) : (
            <span style={{fontSize:11,color:"rgba(255,255,255,0.15)"}}>
              Swipead más pelis
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}>
        <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

import { useState, useEffect } from 'react'

export default function MatchPopup({ movie, matchedFriends, user, onSelectSession, onDismiss }) {
  const [show, setShow] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 50)
    return () => clearTimeout(t)
  }, [])

  const friend = matchedFriends[0]
  if (!friend) return null

  const myAvatar = user?.user_metadata?.avatar_url
  const friendAvatar = friend.avatar_url
  const myName = user?.user_metadata?.full_name?.split(" ")[0] || "Tu"
  const friendName = friend.nombre_display || friend.nombre || "Amigo"

  // Get sessions from movie.allSessions (built by useMovies 14-day load)
  const allSessions = movie.allSessions || []
  const bestSession = allSessions[0] || null

  // Group sessions by day then by cinema
  const sessionsByDay = {}
  allSessions.forEach(s => {
    const dayKey = s.day || s.date
    if (!sessionsByDay[dayKey]) sessionsByDay[dayKey] = {}
    if (!sessionsByDay[dayKey][s.cinema]) sessionsByDay[dayKey][s.cinema] = []
    sessionsByDay[dayKey][s.cinema].push(s)
  })

  function handleSelect(session) {
    onSelectSession(session, friend)
  }

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:500,
      background:"rgba(0,0,0,0.95)",
      display:"flex",flexDirection:"column",alignItems:"center",
      padding:24,
      opacity:show?1:0,
      transition:"opacity 0.4s ease",
      overflowY:"auto",
    }}>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:showAll?"flex-start":"center",width:"100%",maxWidth:380}}>
        {/* Poster with glow */}
        <div style={{position:"relative",marginBottom:24,width:160,height:230,borderRadius:14,overflow:"hidden",boxShadow:"0 0 80px rgba(255,59,59,0.3)",flexShrink:0}}>
          {movie.poster ? (
            <img src={movie.poster} alt={movie.title} style={{width:"100%",height:"100%",objectFit:"cover"}} />
          ) : (
            <div style={{width:"100%",height:"100%",background:"linear-gradient(145deg,#1a1a1a,#111)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:48}}>
              🎬
            </div>
          )}
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)"}} />
        </div>

        {/* Overlapping avatars */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
          <div style={{
            width:44,height:44,borderRadius:"50%",border:"3px solid #000",overflow:"hidden",
            background:"linear-gradient(135deg,#1a1a1a,#111)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2,
          }}>
            {myAvatar ? (
              <img src={myAvatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
            ) : (
              <span style={{fontSize:17,fontWeight:700,color:"#fff"}}>{myName.charAt(0)}</span>
            )}
          </div>
          <div style={{
            width:44,height:44,borderRadius:"50%",border:"3px solid #000",overflow:"hidden",
            background:"linear-gradient(135deg,#1a1a1a,#111)",display:"flex",alignItems:"center",justifyContent:"center",marginLeft:-12,zIndex:1,
          }}>
            {friendAvatar ? (
              <img src={friendAvatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
            ) : (
              <span style={{fontSize:17,fontWeight:700,color:"#fff"}}>{friendName.charAt(0)}</span>
            )}
          </div>
        </div>

        {/* Match text */}
        <p style={{
          margin:"0 0 6px",fontSize:11,fontWeight:700,color:"rgba(255,59,59,0.8)",
          textTransform:"uppercase",letterSpacing:"0.15em",
        }}>Coincidencia</p>

        <h2 style={{
          margin:"0 0 6px",fontSize:24,fontWeight:900,color:"#fff",
          textAlign:"center",fontFamily:"'Moniqa','DM Sans',sans-serif",
          letterSpacing:"0.06em",
        }}>
          {movie.title}
        </h2>

        <p style={{margin:"0 0 24px",fontSize:14,color:"rgba(255,255,255,0.45)",textAlign:"center"}}>
          {myName} y {friendName} quieren verla
        </p>

        {/* Best session card */}
        {bestSession && !showAll && (
          <>
            <p style={{margin:"0 0 10px",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.1em"}}>
              Proxima sesion disponible
            </p>
            <div style={{
              background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:14,padding:"16px 20px",marginBottom:20,width:"100%",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontSize:18}}>📅</div>
                <div>
                  <p style={{margin:0,fontSize:16,fontWeight:700,color:"#fff"}}>{bestSession.day} · {bestSession.time}</p>
                  <p style={{margin:"3px 0 0",fontSize:13,color:"rgba(255,255,255,0.45)",display:"flex",alignItems:"center",gap:4}}>
                    📍 {bestSession.cinema}
                  </p>
                </div>
              </div>
            </div>

            {/* Perfecto button */}
            <button onClick={() => handleSelect(bestSession)} style={{
              width:"100%",padding:"16px",borderRadius:14,
              background:"#fff",color:"#000",
              fontSize:16,fontWeight:800,cursor:"pointer",
              fontFamily:"inherit",border:"none",
              marginBottom:10,
            }}>
              Perfecto ✓
            </button>

            {/* Ver todas las sesiones */}
            {allSessions.length >= 1 && (
              <button onClick={() => setShowAll(true)} style={{
                width:"100%",padding:"14px",borderRadius:14,
                background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.08)",
                color:"rgba(255,255,255,0.6)",
                fontSize:14,fontWeight:600,cursor:"pointer",
                fontFamily:"inherit",
                marginBottom:16,
              }}>
                {allSessions.length > 1
                  ? `Otras opciones (${allSessions.length - 1} mas)`
                  : "Ver todas las sesiones"}
              </button>
            )}
          </>
        )}

        {/* No sessions available */}
        {!bestSession && (
          <div style={{
            background:"rgba(255,69,58,0.08)",border:"1px solid rgba(255,69,58,0.18)",
            borderRadius:14,padding:"14px 16px",marginBottom:20,width:"100%",textAlign:"center",
          }}>
            <p style={{margin:0,fontSize:13,fontWeight:600,color:"#ff453a"}}>Sin sesiones disponibles</p>
            <p style={{margin:"4px 0 0",fontSize:12,color:"rgba(255,255,255,0.4)"}}>Tu voto queda registrado</p>
          </div>
        )}

        {/* All sessions expanded */}
        {showAll && (
          <div style={{width:"100%",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <p style={{margin:0,fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.1em"}}>
                Todas las sesiones
              </p>
              <button onClick={() => setShowAll(false)} style={{
                background:"none",border:"none",color:"rgba(255,255,255,0.4)",
                fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              }}>
                Volver
              </button>
            </div>

            {Object.entries(sessionsByDay).map(([day, cinemas]) => (
              <div key={day} style={{marginBottom:16}}>
                <p style={{margin:"0 0 8px",fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{day}</p>
                {Object.entries(cinemas).map(([cinema, sessions]) => (
                  <div key={cinema} style={{marginBottom:10,paddingLeft:4}}>
                    <p style={{margin:"0 0 6px",fontSize:11,color:"rgba(255,255,255,0.4)",display:"flex",alignItems:"center",gap:4}}>
                      📍 {cinema}
                    </p>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {sessions.map((s, i) => (
                        <button key={i} onClick={() => handleSelect(s)} style={{
                          padding:"8px 14px",borderRadius:8,
                          background:"rgba(255,255,255,0.08)",
                          border:"1px solid rgba(255,255,255,0.08)",
                          color:"#fff",fontSize:13,fontWeight:700,
                          cursor:"pointer",fontFamily:"inherit",
                          transition:"all 0.15s",
                        }}>
                          {s.time}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Close */}
        <button onClick={onDismiss} style={{
          padding:"10px 24px",borderRadius:8,
          background:"none",color:"rgba(255,255,255,0.3)",
          fontSize:13,fontWeight:600,cursor:"pointer",
          fontFamily:"inherit",border:"none",
        }}>
          ✕ Cerrar
        </button>

        {matchedFriends.length > 1 && (
          <p style={{margin:"8px 0 0",fontSize:12,color:"rgba(255,255,255,0.25)"}}>
            +{matchedFriends.length - 1} amigo{matchedFriends.length > 2 ? "s" : ""} mas coinciden
          </p>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import PlanSheet from './PlanSheet.jsx'
import FriendDetailSheet from './FriendDetailSheet.jsx'

// Generate .ics calendar event and trigger download
function addToCalendar(movieTitle, session) {
  if (!session) return
  // Parse date (YYYY-MM-DD) + time (HH:MM)
  const [year, month, day] = (session.date || "").split("-").map(Number)
  const [hours, minutes] = (session.time || "").split(":").map(Number)

  if (!year || !month || !day) return

  // Build DTSTART/DTEND — assume ~2.5h movie
  const start = new Date(year, month - 1, day, hours, minutes)
  const end = new Date(start.getTime() + 150 * 60 * 1000) // +2.5 hours

  const pad = (n) => String(n).padStart(2, "0")
  const toICS = (d) => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CarteleraVO//ES",
    "BEGIN:VEVENT",
    `DTSTART:${toICS(start)}`,
    `DTEND:${toICS(end)}`,
    `SUMMARY:🎬 ${movieTitle}`,
    `LOCATION:${session.cinema || ""}`,
    `DESCRIPTION:Plan de cine — ${movieTitle}\\n${session.cinema || ""}`,
    `STATUS:CONFIRMED`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${movieTitle.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "").trim().replace(/\s+/g, "-")}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function AmigosTab({
  user, friends, pendingIn, pendingOut,
  onAcceptFriend, onRemoveFriend,
  plans, getMyState, onRespondYes, onRespondNo, onSendAvailability, onPickSession, onRejectAll,
  openPlans, onJoinPlan,
  friendSuggestions, onVoyInline,
  onSwitchToCartelera,
  isDemoMode,
  movies,
  onGetFriendsOfFriend,
  onSendDirectRequest,
  friendVotes,
  myVotesForCommon,
  getDemoMoviesInCommon,
  onDiscoverUsers,
  onMarkWatched,
}) {
  const [activePlan, setActivePlan] = useState(null)
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [discoverPeople, setDiscoverPeople] = useState([])
  const [discoverSentTo, setDiscoverSentTo] = useState(new Set())
  const [discoverSending, setDiscoverSending] = useState(null)
  const [discoverSearch, setDiscoverSearch] = useState('')
  const [ratingPlan, setRatingPlan] = useState(null) // planId being rated
  const [ratingValue, setRatingValue] = useState(0)
  const [markedWatched, setMarkedWatched] = useState(new Set())

  // Load discoverable users on mount
  useEffect(() => {
    if (onDiscoverUsers) {
      onDiscoverUsers().then(users => setDiscoverPeople(users || []))
    }
  }, [friends.length]) // refresh when friends change

  const realFriends = friends.filter(f => !f.isDemo)
  const hasAnyFriends = isDemoMode || realFriends.length > 0 || pendingIn.length > 0 || pendingOut.length > 0

  // Filter plans by state
  const confirmedPlans = plans.filter(p => getMyState(p) === 'confirmed')
  const activePlans = plans.filter(p => {
    const s = getMyState(p)
    return s && s !== 'confirmed' && s !== 'no_match'
  })

  // Helper: get poster from movies list
  const getPoster = (title) => (movies || []).find(m => m.title === title)?.poster

  // PlanSheet overlay
  if (activePlan) {
    const plan = plans.find(p => p.id === activePlan)
    if (plan) {
      const partnerName = plan.partner?.nombre_display || plan.partner?.nombre || "Amigo"
      return (
        <div style={{position:"relative",height:"calc(100vh - 56px)"}}>
          <PlanSheet
            plan={plan}
            myState={getMyState(plan)}
            partnerName={partnerName}
            onRespondYes={() => onRespondYes(plan.id)}
            onRespondNo={() => onRespondNo(plan.id)}
            onSendAvailability={(sessions) => onSendAvailability(plan.id, sessions)}
            onPickSession={(session) => onPickSession(plan.id, session)}
            onRejectAll={() => onRejectAll(plan.id)}
            onClose={() => setActivePlan(null)}
          />
        </div>
      )
    }
  }

  const stateLabels = {
    proposed: "Propuesto",
    waiting_them: "Esperando...",
    pick_avail: "Marca fechas",
    waiting_pick: "Esperando...",
    pick_theirs: "Elige fecha",
  }
  const stateColors = {
    proposed: "#ff3b3b",
    waiting_them: "rgba(255,255,255,0.4)",
    pick_avail: "#ffd60a",
    waiting_pick: "rgba(255,255,255,0.4)",
    pick_theirs: "#34c759",
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 56px)",overflow:"hidden"}}>
      {selectedFriend && (
        <FriendDetailSheet
          friend={selectedFriend}
          onGetFriendsOfFriend={onGetFriendsOfFriend}
          onSendDirectRequest={onSendDirectRequest}
          onRemoveFriend={onRemoveFriend}
          onClose={() => setSelectedFriend(null)}
          movies={movies}
          myVotes={myVotesForCommon}
          friendVotes={friendVotes}
          isDemoMode={isDemoMode}
          getDemoMoviesInCommon={getDemoMoviesInCommon}
        />
      )}

      {/* Header */}
      <div style={{padding:"18px 20px 14px",flexShrink:0}}>
        <h1 style={{margin:0,fontSize:22,fontWeight:800,color:"#fff",fontFamily:"'DM Sans',sans-serif",letterSpacing:"-0.01em"}}>Amigos & Planes</h1>
      </div>

      {/* Scrollable content */}
      <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"0 0 100px"}}>

        {/* No friends onboarding */}
        {!hasAnyFriends && (
          <div style={{textAlign:"center",padding:"60px 20px 32px"}}>
            <div style={{width:72,height:72,borderRadius:"50%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 110 8 4 4 0 010-8z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h2 style={{margin:"0 0 8px",fontSize:22,fontWeight:900,fontFamily:"'Moniqa','DM Sans',sans-serif",letterSpacing:"0.01em"}}>Agrega amigos</h2>
            <p style={{margin:"0 0 24px",fontSize:14,color:"rgba(255,255,255,0.4)",lineHeight:1.6,maxWidth:260,marginLeft:"auto",marginRight:"auto"}}>
              Descubre que pelis quieren ver y organiza planes juntos
            </p>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.25)"}}>Busca personas abajo para empezar</p>
          </div>
        )}

        {hasAnyFriends && (
          <>
            {/* Demo banner — compact pill */}
            {isDemoMode && (
              <div style={{margin:"0 20px 14px",borderRadius:12,background:"rgba(255,59,59,0.06)",border:"1px solid rgba(255,59,59,0.15)",padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>🎭</span>
                <span style={{fontSize:12,fontWeight:500,color:"rgba(255,59,59,0.7)",flex:1}}>Modo demo — Carlos es un amigo simulado</span>
              </div>
            )}

            {/* Friend strip — horizontal avatars */}
            <div style={{padding:"0 20px",marginBottom:20}}>
              <div style={{display:"flex",gap:16,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
                {friends.map(f => (
                  <div key={f.id} onClick={() => setSelectedFriend(f)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flexShrink:0,cursor:"pointer"}}>
                    <div style={{width:48,height:48,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#1a1a1a,#111)",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid rgba(255,255,255,0.08)"}}>
                      {f.avatar_url ? (
                        <img src={f.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                      ) : (
                        <span style={{fontSize:16,fontWeight:700,color:"#fff"}}>{(f.nombre_display || f.nombre || "?").charAt(0)}</span>
                      )}
                    </div>
                    <span style={{fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.5)",maxWidth:56,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {(f.nombre_display || f.nombre || "").split(" ")[0]}
                    </span>
                  </div>
                ))}
                {/* Add friend — scroll to discover section */}
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flexShrink:0,cursor:"pointer"}} onClick={() => {
                  const el = document.getElementById('discover-section')
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}>
                  <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(255,255,255,0.06)",border:"2px dashed rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14m-7-7h14" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"/></svg>
                  </div>
                  <span style={{fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.3)"}}>Agregar</span>
                </div>
              </div>
            </div>

            {/* Pending friend requests — compact */}
            {pendingIn.length > 0 && (
              <div style={{padding:"0 20px",marginBottom:16}}>
                {pendingIn.map(req => (
                  <div key={req.friendshipId} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(100,149,237,0.06)",border:"1px solid rgba(100,149,237,0.15)",borderRadius:14,padding:"10px 14px",marginBottom:6}}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(100,149,237,0.25)",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {req.avatar_url ? (
                        <img src={req.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                      ) : (
                        <span style={{fontSize:12,fontWeight:700,color:"#fff"}}>{(req.nombre_display || req.nombre || "?").charAt(0)}</span>
                      )}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:0,fontSize:13,fontWeight:600,color:"#fff"}}>{req.nombre_display || req.nombre}</p>
                    </div>
                    <button onClick={() => onAcceptFriend(req.friendshipId)} style={{padding:"6px 14px",borderRadius:8,background:"rgba(52,199,89,0.12)",border:"1px solid rgba(52,199,89,0.25)",color:"#34c759",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Aceptar</button>
                    <button onClick={() => onRemoveFriend(req.friendshipId)} style={{padding:"6px 8px",borderRadius:8,background:"rgba(255,69,58,0.08)",border:"1px solid rgba(255,69,58,0.15)",color:"#ff453a",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Pending outgoing — show where my sent invitations are */}
            {pendingOut.length > 0 && (
              <div style={{padding:"0 20px",marginBottom:16}}>
                <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.1em"}}>Enviadas</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {pendingOut.map(req => (
                    <div key={req.friendshipId} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"5px 12px 5px 5px"}}>
                      <div style={{width:24,height:24,borderRadius:"50%",background:"linear-gradient(135deg,#1a1a1a,#111)",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {req.avatar_url ? (
                          <img src={req.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                        ) : (
                          <span style={{fontSize:10,fontWeight:700,color:"#fff"}}>{(req.nombre_display || req.nombre || "?").charAt(0)}</span>
                        )}
                      </div>
                      <span style={{fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.4)"}}>{(req.nombre_display || req.nombre || "").split(" ")[0]}</span>
                      <span style={{fontSize:10,color:"rgba(255,255,255,0.2)"}}>pendiente</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION: Planes (confirmed + joinable) */}
            {(confirmedPlans.length > 0 || openPlans.length > 0) && (
              <div style={{padding:"0 20px",marginBottom:20}}>
                <p style={{margin:"0 0 10px",fontSize:11,fontWeight:700,color:"rgba(52,199,89,0.6)",textTransform:"uppercase",letterSpacing:"0.1em"}}>Planes</p>

                {confirmedPlans.map(plan => {
                  const poster = getPoster(plan.movie_title)
                  const isRating = ratingPlan === plan.id
                  const alreadyMarked = markedWatched.has(plan.id)
                  return (
                    <div key={plan.id} style={{background:"rgba(52,199,89,0.05)",border:"1px solid rgba(52,199,89,0.18)",borderRadius:14,padding:12,marginBottom:10,transition:"all 0.2s"}}>
                      <div style={{display:"flex",gap:14,alignItems:"center",cursor:"pointer"}} onClick={() => addToCalendar(plan.movie_title, plan.chosen_session)}>
                        {/* Poster thumbnail */}
                        <div style={{width:56,height:84,borderRadius:8,overflow:"hidden",flexShrink:0,background:"linear-gradient(145deg,#1a1a1a,#111)"}}>
                          {poster && <img src={poster} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />}
                        </div>
                        {/* Info */}
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{margin:"0 0 4px",fontSize:15,fontWeight:900,fontFamily:"'Moniqa','DM Sans',sans-serif",color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{plan.movie_title}</p>
                          {plan.chosen_session && (
                            <p style={{margin:"0 0 6px",fontSize:12,color:"rgba(255,255,255,0.45)",lineHeight:1.4}}>
                              {plan.chosen_session.day || plan.chosen_session.date} · {plan.chosen_session.time}<br/>
                              {plan.chosen_session.cinema}
                            </p>
                          )}
                          <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                            {(plan.participants || []).map((pid) => {
                              const f = friends.find(fr => fr.id === pid)
                              const pp = (plan.participantProfiles || []).find(p => p.id === pid)
                              const name = pid === user?.id ? "Tu" : (f?.nombre_display || f?.nombre || pp?.nombre_display || pp?.nombre || "Amigo")
                              return <span key={pid} style={{fontSize:10,color:"rgba(255,255,255,0.5)",background:"rgba(255,255,255,0.06)",padding:"2px 7px",borderRadius:6}}>{name}</span>
                            })}
                            <span style={{fontSize:10,fontWeight:700,color:"#34c759",marginLeft:4}}>✓ Confirmado</span>
                          </div>
                        </div>
                      </div>
                      {/* Action buttons row */}
                      <div style={{display:"flex",gap:8,marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                        <button onClick={() => addToCalendar(plan.movie_title, plan.chosen_session)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"8px 0",borderRadius:10,background:"rgba(52,199,89,0.08)",border:"1px solid rgba(52,199,89,0.18)",color:"#34c759",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#34c759" strokeWidth="1.5"/><path d="M16 2v4M8 2v4M3 10h18" stroke="#34c759" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          Calendario
                        </button>
                        {alreadyMarked ? (
                          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"8px 0",borderRadius:10,background:"rgba(255,59,59,0.08)",border:"1px solid rgba(255,59,59,0.18)",color:"#ff3b3b",fontSize:11,fontWeight:600}}>
                            <span>★</span> Vista
                          </div>
                        ) : (
                          <button onClick={() => { setRatingPlan(isRating ? null : plan.id); setRatingValue(0) }} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"8px 0",borderRadius:10,background:isRating?"rgba(255,59,59,0.12)":"rgba(255,255,255,0.04)",border:`1px solid ${isRating?"rgba(255,59,59,0.25)":"rgba(255,255,255,0.08)"}`,color:isRating?"#ff3b3b":"rgba(255,255,255,0.5)",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
                            Vista
                          </button>
                        )}
                      </div>
                      {/* Star rating panel */}
                      {isRating && !alreadyMarked && (
                        <div style={{marginTop:10,padding:"12px 0 2px",borderTop:"1px solid rgba(255,255,255,0.06)",textAlign:"center"}}>
                          <p style={{margin:"0 0 10px",fontSize:12,color:"rgba(255,255,255,0.4)",fontWeight:500}}>Que te parecio?</p>
                          <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:12}}>
                            {[1,2,3,4,5].map(star => (
                              <button key={star} onClick={() => setRatingValue(star)} style={{background:"none",border:"none",cursor:"pointer",padding:4,fontSize:28,color:star<=ratingValue?"#ffd60a":"rgba(255,255,255,0.12)",transition:"all 0.15s",transform:star<=ratingValue?"scale(1.15)":"scale(1)"}}>
                                ★
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              if (ratingValue > 0 && onMarkWatched) {
                                onMarkWatched(plan.movie_title, ratingValue)
                                setMarkedWatched(prev => new Set([...prev, plan.id]))
                                setRatingPlan(null)
                              }
                            }}
                            disabled={ratingValue === 0}
                            style={{padding:"8px 24px",borderRadius:10,background:ratingValue>0?"rgba(255,59,59,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${ratingValue>0?"rgba(255,59,59,0.3)":"rgba(255,255,255,0.08)"}`,color:ratingValue>0?"#ff3b3b":"rgba(255,255,255,0.2)",fontSize:13,fontWeight:700,cursor:ratingValue>0?"pointer":"default",fontFamily:"inherit",transition:"all 0.2s"}}
                          >
                            Guardar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}

                {openPlans.map(plan => {
                  const poster = getPoster(plan.movie_title)
                  return (
                    <div key={plan.id} style={{display:"flex",gap:14,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:12,marginBottom:10,alignItems:"center"}}>
                      <div style={{width:56,height:84,borderRadius:8,overflow:"hidden",flexShrink:0,background:"linear-gradient(145deg,#1a1a1a,#111)"}}>
                        {poster && <img src={poster} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{margin:"0 0 4px",fontSize:15,fontWeight:900,fontFamily:"'Moniqa','DM Sans',sans-serif",color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{plan.movie_title}</p>
                        {plan.chosen_session && (
                          <p style={{margin:"0 0 6px",fontSize:12,color:"rgba(255,255,255,0.4)"}}>
                            {plan.chosen_session.day || plan.chosen_session.date} · {plan.chosen_session.time}
                          </p>
                        )}
                        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
                          {(plan.participantProfiles || []).map((p, i) => (
                            <span key={i} style={{fontSize:10,color:"rgba(255,255,255,0.5)",background:"rgba(255,255,255,0.06)",padding:"2px 7px",borderRadius:6}}>{p.nombre_display || p.nombre}</span>
                          ))}
                        </div>
                        <button onClick={() => onJoinPlan(plan.id)} style={{padding:"7px 18px",borderRadius:8,background:"rgba(52,199,89,0.1)",border:"1px solid rgba(52,199,89,0.25)",color:"#34c759",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                          Apuntarme
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* SECTION: Coincidis (active negotiations) */}
            {activePlans.length > 0 && (
              <div style={{padding:"0 20px",marginBottom:20}}>
                <p style={{margin:"0 0 10px",fontSize:11,fontWeight:700,color:"rgba(255,59,59,0.7)",textTransform:"uppercase",letterSpacing:"0.1em"}}>Coincidis</p>
                {activePlans.map(plan => {
                  const state = getMyState(plan)
                  const partnerName = plan.partner?.nombre_display || plan.partner?.nombre || "Amigo"
                  const isWaiting = state === 'waiting_them' || state === 'waiting_pick'
                  const poster = getPoster(plan.movie_title)

                  return (
                    <div key={plan.id} onClick={() => !isWaiting && setActivePlan(plan.id)} style={{display:"flex",gap:14,background:"rgba(255,59,59,0.04)",border:"1px solid rgba(255,59,59,0.15)",borderRadius:14,padding:12,marginBottom:10,alignItems:"center",cursor:isWaiting?"default":"pointer",transition:"all 0.2s"}}>
                      <div style={{width:56,height:84,borderRadius:8,overflow:"hidden",flexShrink:0,background:"linear-gradient(145deg,#1a1a1a,#111)"}}>
                        {poster && <img src={poster} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                          <p style={{margin:"0 0 4px",fontSize:15,fontWeight:900,fontFamily:"'Moniqa','DM Sans',sans-serif",color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>{plan.movie_title}</p>
                          <span style={{fontSize:10,fontWeight:700,color:stateColors[state]||"#fff",background:"rgba(255,255,255,0.06)",borderRadius:8,padding:"3px 8px",flexShrink:0,whiteSpace:"nowrap"}}>
                            {stateLabels[state] || state}
                          </span>
                        </div>
                        <p style={{margin:"0 0 8px",fontSize:12,color:"rgba(255,255,255,0.35)"}}>con {partnerName}</p>
                        {isWaiting ? (
                          <span style={{fontSize:12,color:"rgba(255,255,255,0.25)"}}>Esperando a {partnerName.split(" ")[0]}...</span>
                        ) : (
                          <span style={{fontSize:12,fontWeight:600,color:"#ff3b3b"}}>Abrir →</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* SECTION: Quieren ver — horizontal poster scroll */}
            {friendSuggestions.length > 0 && (
              <div style={{marginBottom:20}}>
                <p style={{margin:"0 0 10px",padding:"0 20px",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.1em"}}>Quieren ver</p>
                <div style={{display:"flex",gap:12,overflowX:"auto",padding:"0 20px",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
                  {friendSuggestions.map(({ movieTitle, voters }) => {
                    const poster = getPoster(movieTitle)
                    return (
                      <div key={movieTitle} style={{flexShrink:0,width:120,position:"relative"}}>
                        {/* Poster card */}
                        <div style={{width:120,height:180,borderRadius:14,overflow:"hidden",position:"relative",background:"linear-gradient(145deg,#1a1a1a,#111)",marginBottom:8}}>
                          {poster && <img src={poster} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />}
                          {/* Gradient overlay */}
                          <div style={{position:"absolute",inset:0,background:"linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)"}} />
                          {/* Movie title overlay */}
                          <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"8px 10px"}}>
                            <p style={{margin:0,fontSize:12,fontWeight:900,fontFamily:"'Moniqa','DM Sans',sans-serif",color:"#fff",lineHeight:1.2,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{movieTitle}</p>
                          </div>
                          {/* Friend avatars — top right */}
                          <div style={{position:"absolute",top:8,right:8,display:"flex"}}>
                            {voters.slice(0, 2).map((v, i) => (
                              <div key={v.userId} style={{width:22,height:22,borderRadius:"50%",background:`hsl(${i*80+200},50%,40%)`,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",marginLeft:i>0?-6:0,border:"1.5px solid rgba(0,0,0,0.5)"}}>
                                {v.avatar_url ? (
                                  <img src={v.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                                ) : (
                                  <span style={{fontSize:9,fontWeight:700,color:"#fff"}}>{v.name.charAt(0)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* VOY button */}
                        <button onClick={() => onVoyInline(movieTitle)} style={{width:"100%",padding:"8px 0",borderRadius:8,background:"rgba(52,199,89,0.1)",border:"1px solid rgba(52,199,89,0.2)",color:"#34c759",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                          VOY
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty state — when no activity */}
            {activePlans.length === 0 && confirmedPlans.length === 0 && openPlans.length === 0 && friendSuggestions.length === 0 && (
              <div style={{textAlign:"center",padding:"40px 20px"}}>
                <div style={{fontSize:36,marginBottom:12}}>🎟️</div>
                <p style={{color:"rgba(255,255,255,0.45)",fontSize:15,fontWeight:900,fontFamily:"'Moniqa','DM Sans',sans-serif",margin:"0 0 6px"}}>Sin actividad aun</p>
                <p style={{color:"rgba(255,255,255,0.25)",fontSize:13,margin:"0 0 20px",lineHeight:1.6}}>Desliza peliculas a la derecha para descubrir coincidencias con tus amigos</p>
                <button onClick={onSwitchToCartelera} style={{padding:"12px 28px",borderRadius:14,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Ir a la cartelera</button>
              </div>
            )}

          </>
        )}

        {/* SECTION: Discover people — social feed (always visible) */}
        {discoverPeople.length > 0 && (
          <div id="discover-section" style={{padding:"0 20px",marginBottom:20}}>
            <p style={{margin:"0 0 12px",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.1em"}}>Personas en VOSE</p>

            {/* Search input */}
            <div style={{position:"relative",marginBottom:12}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
                <circle cx="11" cy="11" r="7" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
                <path d="M16 16l4.5 4.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                value={discoverSearch}
                onChange={e => setDiscoverSearch(e.target.value)}
                placeholder="Buscar personas..."
                style={{width:"100%",padding:"10px 12px 10px 34px",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#fff",fontSize:13,fontWeight:500,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}
              />
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {discoverPeople
                .filter(u => {
                  if (!discoverSearch.trim()) return true
                  const q = discoverSearch.toLowerCase()
                  const name = (u.nombre_display || u.nombre || "").toLowerCase()
                  return name.includes(q)
                })
                .sort((a, b) => {
                  const aSent = discoverSentTo.has(a.id) ? 1 : 0
                  const bSent = discoverSentTo.has(b.id) ? 1 : 0
                  return aSent - bSent
                })
                .map(person => {
                const personName = person.nombre_display || person.nombre || "Usuario"
                const alreadySent = discoverSentTo.has(person.id)
                const isSending = discoverSending === person.id
                return (
                  <div key={person.id} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"10px 14px"}}>
                    <div style={{width:40,height:40,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#1a1a1a,#111)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"2px solid rgba(255,255,255,0.1)"}}>
                      {person.avatar_url ? (
                        <img src={person.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                      ) : (
                        <span style={{fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{personName.charAt(0)}</span>
                      )}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:0,fontSize:14,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{personName}</p>
                      {person.invited_by_name && (
                        <p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.25)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          Invitado de {person.invited_by_name}
                        </p>
                      )}
                    </div>
                    {alreadySent ? (
                      <span style={{fontSize:11,fontWeight:700,color:"#34c759",padding:"6px 12px",background:"rgba(52,199,89,0.1)",borderRadius:10}}>Enviada ✓</span>
                    ) : (
                      <button
                        onClick={async () => {
                          setDiscoverSending(person.id)
                          const result = await onSendDirectRequest(person.id)
                          setDiscoverSending(null)
                          if (result?.success) {
                            setDiscoverSentTo(prev => new Set([...prev, person.id]))
                          }
                        }}
                        disabled={isSending}
                        style={{padding:"6px 14px",borderRadius:10,background:"rgba(52,199,89,0.12)",border:"1px solid rgba(52,199,89,0.25)",color:"#34c759",fontSize:12,fontWeight:700,cursor:isSending?"not-allowed":"pointer",fontFamily:"inherit",opacity:isSending?0.5:1}}
                      >
                        {isSending ? "..." : "Agregar"}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

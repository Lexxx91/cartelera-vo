import { useState, useEffect } from 'react'
import PlanSheet from './PlanSheet.jsx'
import FriendDetailSheet from './FriendDetailSheet.jsx'

// Countdown helper: returns "Xd Xh" or "Xh Xm" or "Ahora!" text
function useCountdown(session) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000) // update every minute
    return () => clearInterval(t)
  }, [])

  if (!session?.date || !session?.time) return null
  const [year, month, day] = session.date.split("-").map(Number)
  const [hours, minutes] = (session.time || "00:00").split(":").map(Number)
  if (!year) return null
  const target = new Date(year, month - 1, day, hours || 0, minutes || 0).getTime()
  const diff = target - now
  if (diff <= 0) return null
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (days > 0) return `${days}d ${hrs}h`
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

function CountdownBadge({ session }) {
  const text = useCountdown(session)
  if (!text) return null
  return (
    <span style={{fontSize:10,fontWeight:700,color:"#ff3b3b",background:"rgba(255,59,59,0.1)",padding:"3px 8px",borderRadius:8,whiteSpace:"nowrap"}}>
      ⏱ {text}
    </span>
  )
}

// Open Google Calendar with pre-filled event + invitees
function addToCalendar(movieTitle, session, inviteeEmails) {
  if (!session) return
  const [year, month, day] = (session.date || "").split("-").map(Number)
  const [hours, minutes] = (session.time || "").split(":").map(Number)
  if (!year || !month || !day) return
  const start = new Date(year, month - 1, day, hours || 0, minutes || 0)
  const end = new Date(start.getTime() + 150 * 60 * 1000)
  const pad = (n) => String(n).padStart(2, "0")
  const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `🎬 ${movieTitle}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    location: session.cinema || '',
    details: `Plan de cine VOSE — ${movieTitle}\n${session.cinema || ''}`,
  })
  // Add invitees if available
  const emails = (inviteeEmails || []).filter(Boolean)
  if (emails.length > 0) {
    params.set('add', emails.join(','))
  }
  window.open(`https://calendar.google.com/calendar/r/eventedit?${params.toString()}`, '_blank')
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
  onSavePayer,
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
            user={user}
            friends={friends}
            onRespondYes={() => onRespondYes(plan.id)}
            onRespondNo={() => onRespondNo(plan.id)}
            onSendAvailability={(sessions) => onSendAvailability(plan.id, sessions)}
            onPickSession={(session) => onPickSession(plan.id, session)}
            onRejectAll={() => onRejectAll(plan.id)}
            onClose={() => setActivePlan(null)}
            onSavePayer={(payerName) => onSavePayer && onSavePayer(plan.id, payerName)}
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
    pick_theirs: "#ff3b3b",
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
        <h1 style={{margin:0,fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:22,color:"#fff",letterSpacing:"0.02em",textTransform:"uppercase"}}>Amigos & Planes</h1>
      </div>

      {/* Scrollable content */}
      <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"0 0 100px"}}>

        {/* No friends onboarding — landing style */}
        {!hasAnyFriends && (
          <div style={{textAlign:"center",padding:"48px 24px 32px",animation:"fadeIn 0.6s ease"}}>
            <h2 style={{margin:"0 0 6px",fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:36,lineHeight:0.95,textTransform:"uppercase",letterSpacing:"-0.02em"}}>
              <span style={{WebkitTextStroke:"1.5px #fff",color:"transparent",display:"block"}}>AGREGA</span>
              <span style={{color:"#ff3b3b",display:"block"}}>AMIGOS</span>
            </h2>
            <p style={{margin:"12px auto 24px",fontSize:13,color:"rgba(255,255,255,0.4)",lineHeight:1.6,maxWidth:240}}>
              Descubre que pelis quieren ver y organiza planes juntos
            </p>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.2)"}}>Busca personas abajo para empezar ↓</p>
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
                    <button onClick={() => onAcceptFriend(req.friendshipId)} style={{padding:"6px 14px",borderRadius:8,background:"rgba(255,59,59,0.12)",border:"1px solid rgba(255,59,59,0.25)",color:"#ff3b3b",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Aceptar</button>
                    <button onClick={() => onRemoveFriend(req.friendshipId)} style={{padding:"6px 8px",borderRadius:8,background:"rgba(255,69,58,0.08)",border:"1px solid rgba(255,69,58,0.15)",color:"#ff453a",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Pending outgoing — show where my sent invitations are */}
            {pendingOut.length > 0 && (
              <div style={{padding:"0 20px",marginBottom:16}}>
                <p style={{margin:"0 0 8px",fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Enviadas</p>
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
                <p style={{margin:"0 0 12px",fontSize:13,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"#ff3b3b",textTransform:"uppercase",letterSpacing:"0.06em"}}>Planes</p>

                {confirmedPlans.map(plan => {
                  const poster = getPoster(plan.movie_title)
                  const isRating = ratingPlan === plan.id
                  const alreadyMarked = markedWatched.has(plan.id)
                  return (
                    <div key={plan.id} style={{background:"rgba(255,59,59,0.05)",border:"1px solid rgba(255,59,59,0.18)",borderRadius:14,padding:12,marginBottom:10,transition:"all 0.2s"}}>
                      <div style={{display:"flex",gap:14,alignItems:"center",cursor:"pointer"}} onClick={() => setActivePlan(plan.id)}>
                        {/* Poster thumbnail */}
                        <div style={{width:56,height:84,borderRadius:8,overflow:"hidden",flexShrink:0,background:"linear-gradient(145deg,#1a1a1a,#111)"}}>
                          {poster && <img src={poster} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />}
                        </div>
                        {/* Info */}
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{margin:"0 0 4px",fontSize:15,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{plan.movie_title}</p>
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
                            <span style={{fontSize:10,fontWeight:700,color:"#ff3b3b",marginLeft:4}}>✓ Confirmado</span>
                            <CountdownBadge session={plan.chosen_session} />
                          </div>
                        </div>
                      </div>
                      {/* Action buttons row */}
                      <div style={{display:"flex",gap:8,marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                        <button onClick={() => addToCalendar(plan.movie_title, plan.chosen_session, [plan.partner?.email])} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"8px 0",borderRadius:10,background:"rgba(255,59,59,0.08)",border:"1px solid rgba(255,59,59,0.18)",color:"#ff3b3b",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#ff3b3b" strokeWidth="1.5"/><path d="M16 2v4M8 2v4M3 10h18" stroke="#ff3b3b" strokeWidth="1.5" strokeLinecap="round"/></svg>
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
                                const planContext = {
                                  cinema: plan.chosen_session?.cinema,
                                  time: plan.chosen_session?.time,
                                  with: (plan.participants || [])
                                    .filter(pid => pid !== user?.id)
                                    .map(pid => {
                                      const f = friends.find(fr => fr.id === pid)
                                      return f?.nombre_display || f?.nombre || "Amigo"
                                    }),
                                }
                                onMarkWatched(plan.movie_title, ratingValue, planContext)
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
                        <p style={{margin:"0 0 4px",fontSize:15,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{plan.movie_title}</p>
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
                        <button onClick={() => onJoinPlan(plan.id)} style={{padding:"7px 18px",borderRadius:8,background:"rgba(255,59,59,0.1)",border:"1px solid rgba(255,59,59,0.25)",color:"#ff3b3b",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
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
                <p style={{margin:"0 0 12px",fontSize:13,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"#ff3b3b",textTransform:"uppercase",letterSpacing:"0.06em"}}>Coincidis</p>
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
                          <p style={{margin:"0 0 4px",fontSize:15,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>{plan.movie_title}</p>
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
                <p style={{margin:"0 0 10px",padding:"0 20px",fontSize:13,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Quieren ver</p>
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
                            <p style={{margin:0,fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"#fff",lineHeight:1.2,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{movieTitle}</p>
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
                        <button onClick={() => onVoyInline(movieTitle)} style={{width:"100%",padding:"8px 0",borderRadius:8,background:"rgba(255,59,59,0.1)",border:"1px solid rgba(255,59,59,0.2)",color:"#ff3b3b",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                          VOY
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty state — landing style */}
            {activePlans.length === 0 && confirmedPlans.length === 0 && openPlans.length === 0 && friendSuggestions.length === 0 && (
              <div style={{textAlign:"center",padding:"40px 24px",animation:"fadeIn 0.6s ease"}}>
                <h3 style={{margin:"0 0 10px",fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:28,lineHeight:0.95,textTransform:"uppercase",letterSpacing:"-0.02em"}}>
                  <span style={{WebkitTextStroke:"1.2px #fff",color:"transparent",display:"block"}}>SIN</span>
                  <span style={{color:"#ff3b3b",display:"block"}}>PLANES</span>
                </h3>
                <p style={{color:"rgba(255,255,255,0.3)",fontSize:13,margin:"0 0 20px",lineHeight:1.6,maxWidth:240,marginLeft:"auto",marginRight:"auto"}}>Desliza pelis a la derecha para descubrir coincidencias con tus amigos</p>
                <button onClick={onSwitchToCartelera} style={{padding:"12px 28px",borderRadius:14,background:"#ff3b3b",border:"none",color:"#000",fontSize:13,fontWeight:800,fontFamily:"'Archivo Black',sans-serif",cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.02em"}}>Ir a la cartelera</button>
              </div>
            )}

          </>
        )}

        {/* SECTION: Discover people — social feed (always visible) */}
        {discoverPeople.length > 0 && (
          <div id="discover-section" style={{padding:"0 20px",marginBottom:20}}>
            <p style={{margin:"0 0 12px",fontSize:13,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Personas en VO<span style={{color:"#ff3b3b"}}>SE</span></p>

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
                      <span style={{fontSize:11,fontWeight:700,color:"#ff3b3b",padding:"6px 12px",background:"rgba(255,59,59,0.1)",borderRadius:10}}>Enviada ✓</span>
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
                        style={{padding:"6px 14px",borderRadius:10,background:"rgba(255,59,59,0.12)",border:"1px solid rgba(255,59,59,0.25)",color:"#ff3b3b",fontSize:12,fontWeight:700,cursor:isSending?"not-allowed":"pointer",fontFamily:"inherit",opacity:isSending?0.5:1}}
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

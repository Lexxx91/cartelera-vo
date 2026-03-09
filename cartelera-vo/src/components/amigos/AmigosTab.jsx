import { useState, useEffect, useRef } from 'react'
import PlanSheet from './PlanSheet.jsx'
import FriendDetailSheet from './FriendDetailSheet.jsx'
import FriendRequestSheet from './FriendRequestSheet.jsx'

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
  const emails = (inviteeEmails || []).filter(Boolean)
  if (emails.length > 0) {
    params.set('add', emails.join(','))
  }
  window.open(`https://calendar.google.com/calendar/r/eventedit?${params.toString()}`, '_blank')
}

// Confetti particle component for friend accept celebration
function FriendConfetti({ onDone }) {
  const emojis = ['🎉','🤝','✨','🎊','⭐','💫']
  const [particles] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      x: 30 + Math.random() * 40, // % from left
      delay: Math.random() * 0.3,
      duration: 1 + Math.random() * 0.5,
      drift: (Math.random() - 0.5) * 40,
      size: 14 + Math.random() * 10,
    }))
  )
  useEffect(() => {
    const t = setTimeout(onDone, 1800)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden',zIndex:10}}>
      <style>{`
        @keyframes confettiFly{
          0%{transform:translateY(0) translateX(0) scale(1) rotate(0deg);opacity:1}
          70%{opacity:1}
          100%{transform:translateY(-120px) translateX(var(--drift)) scale(0.3) rotate(360deg);opacity:0}
        }
      `}</style>
      {particles.map(p => (
        <span key={p.id} style={{
          position:'absolute', left:`${p.x}%`, bottom:'10px',
          fontSize:p.size,
          '--drift': `${p.drift}px`,
          animation: `confettiFly ${p.duration}s ease-out ${p.delay}s forwards`,
          opacity:0,
          animationFillMode:'forwards',
        }}>{p.emoji}</span>
      ))}
    </div>
  )
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
  onShowShareCard,
  onSaveRating,
  onLeavePlan,
  profile,
  // WhatsApp / VOCITO props
  onConnectWhatsApp,
  onUnlinkWhatsApp,
  waLinking,
  whatsappLinked,
}) {
  const [activePlan, setActivePlan] = useState(null)
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [discoverPeople, setDiscoverPeople] = useState([])
  const [discoverSentTo, setDiscoverSentTo] = useState(new Set())
  const [discoverSending, setDiscoverSending] = useState(null)
  const [discoverSearch, setDiscoverSearch] = useState('')
  const [showRequestSheet, setShowRequestSheet] = useState(false)
  const [subTab, setSubTab] = useState("amigos") // "amigos" | "personas" | "pendientes"
  const sheetShownForRef = useRef(new Set()) // track which requests we auto-showed for

  // Auto-show friend request bottom sheet when new requests arrive
  useEffect(() => {
    if (pendingIn.length > 0) {
      const hasNew = pendingIn.some(r => !sheetShownForRef.current.has(r.friendshipId))
      if (hasNew) {
        setShowRequestSheet(true)
        pendingIn.forEach(r => sheetShownForRef.current.add(r.friendshipId))
      }
    }
  }, [pendingIn])

  // Load discoverable users on mount
  useEffect(() => {
    if (onDiscoverUsers) {
      onDiscoverUsers().then(users => setDiscoverPeople(users || []))
    }
  }, [friends.length]) // refresh when friends change

  // Filter plans by state
  const confirmedPlans = plans.filter(p => getMyState(p) === 'confirmed')
  const activePlans = plans.filter(p => {
    const s = getMyState(p)
    return s && s !== 'confirmed' && s !== 'no_match'
  })

  // Helper: get poster from movies list
  const getPoster = (title) => (movies || []).find(m => m.title === title)?.poster

  // Share invite link
  function handleShareInvite() {
    const code = profile?.invite_code || ''
    const url = `https://cartelera-vo.vercel.app?code=${code}`
    if (navigator.share) {
      navigator.share({
        title: 'VOSE — Cine en VO con amigos',
        text: `¿Vamos pal cine? 🎬 Con VOSE haces swipe en la cartelera de VO de Las Palmas y cuando coincides con un amigo se monta el plan solo. Sin audios. Sin grupos muertos.`,
        url,
      }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(`¿Vamos pal cine? 🎬 ${url}`)
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

  const hasPlans = confirmedPlans.length > 0 || openPlans.length > 0 || activePlans.length > 0 || friendSuggestions.length > 0
  const pendingTotal = pendingIn.length + pendingOut.length

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
            posterUrl={getPoster(plan.movie_title)}
            user={user}
            friends={friends}
            onRespondYes={() => onRespondYes(plan.id)}
            onRespondNo={() => onRespondNo(plan.id)}
            onSendAvailability={(sessions) => onSendAvailability(plan.id, sessions)}
            onPickSession={(session) => onPickSession(plan.id, session)}
            onRejectAll={() => onRejectAll(plan.id)}
            onClose={() => setActivePlan(null)}
            onSavePayer={(payerName) => onSavePayer && onSavePayer(plan.id, payerName)}
            onShare={() => onShowShareCard && onShowShareCard(plan.id)}
            onSaveRating={onSaveRating ? (rating) => onSaveRating(plan.id, rating) : null}
            onLeavePlan={onLeavePlan ? () => { onLeavePlan(plan.id); setActivePlan(null) } : null}
          />
        </div>
      )
    }
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

      {/* Friend Request Bottom Sheet */}
      {showRequestSheet && pendingIn.length > 0 && (
        <FriendRequestSheet
          requests={pendingIn}
          onAccept={onAcceptFriend}
          onReject={onRemoveFriend}
          onClose={() => setShowRequestSheet(false)}
        />
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* SINGLE SCROLL CONTAINER                      */}
      {/* ═══════════════════════════════════════════ */}
      <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"0 0 100px",minHeight:0}}>

        {/* Header */}
        <div style={{padding:"18px 20px 14px",flexShrink:0}}>
          <h1 style={{margin:0,fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:22,color:"#fff",letterSpacing:"0.02em",textTransform:"uppercase"}}>Planes</h1>
        </div>

        {/* Demo banner */}
        {isDemoMode && (
          <div style={{margin:"0 20px 14px",borderRadius:12,background:"rgba(255,59,59,0.06)",border:"1px solid rgba(255,59,59,0.15)",padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14}}>🎭</span>
            <span style={{fontSize:12,fontWeight:500,color:"rgba(255,59,59,0.7)",flex:1}}>Modo demo — Carlos es un amigo simulado</span>
          </div>
        )}

        {/* Confirmed plans */}
        {confirmedPlans.length > 0 && (
          <div style={{padding:"0 20px",marginBottom:8}}>
            {confirmedPlans.map(plan => {
              const poster = getPoster(plan.movie_title)
              const hasRatings = plan.ratings && Object.keys(plan.ratings).length > 0
              return (
                <div key={plan.id} onClick={() => setActivePlan(plan.id)} style={{
                  position: "relative", borderRadius: 18, overflow: "hidden",
                  marginBottom: 12, cursor: "pointer", height: 160,
                  border: "1px solid rgba(255,59,59,0.2)",
                  transition: "all 0.2s",
                }}>
                  {poster && (
                    <img src={poster} alt="" style={{
                      position: "absolute", inset: 0,
                      width: "100%", height: "100%",
                      objectFit: "cover", opacity: 0.4,
                    }} />
                  )}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.3) 100%)",
                  }} />
                  <div style={{
                    position: "relative", zIndex: 1,
                    height: "100%", padding: "14px 16px",
                    display: "flex", flexDirection: "column",
                    justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: "#ff3b3b",
                        background: "rgba(255,59,59,0.15)", padding: "3px 10px",
                        borderRadius: 8, backdropFilter: "blur(8px)",
                      }}>
                        CONFIRMADO ✓
                      </span>
                      <CountdownBadge session={plan.chosen_session} />
                    </div>
                    <div>
                      <p style={{
                        margin: "0 0 4px", fontSize: 18, fontWeight: 400,
                        fontFamily: "'Archivo Black',sans-serif", color: "#fff",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                      }}>
                        {plan.movie_title}
                      </p>
                      {plan.chosen_session && (
                        <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                          {plan.chosen_session.day || plan.chosen_session.date} · {plan.chosen_session.time} · {(plan.chosen_session.cinema || "").split(" ").slice(0,3).join(" ")}
                        </p>
                      )}
                      <div style={{ display: "flex", alignItems: "center" }}>
                        {(plan.participants || []).slice(0, 4).map((pid, i) => {
                          const f = friends.find(fr => fr.id === pid)
                          const pp = (plan.participantProfiles || []).find(p => p.id === pid)
                          const isMe = pid === user?.id
                          const avatar = isMe ? user?.user_metadata?.avatar_url : (f?.avatar_url || pp?.avatar_url)
                          const name = isMe ? "Tu" : (f?.nombre_display || f?.nombre || pp?.nombre_display || pp?.nombre || "?")
                          return (
                            <div key={pid} style={{
                              width: 28, height: 28, borderRadius: "50%",
                              overflow: "hidden", marginLeft: i > 0 ? -8 : 0,
                              border: "2px solid rgba(0,0,0,0.6)",
                              background: "linear-gradient(135deg, #1a1a1a, #111)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              zIndex: 4 - i,
                            }}>
                              {avatar ? (
                                <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{name.charAt(0)}</span>
                              )}
                            </div>
                          )
                        })}
                        <span style={{ marginLeft: 8, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                          {(plan.participants || []).map(pid => {
                            if (pid === user?.id) return "Tu"
                            const f = friends.find(fr => fr.id === pid)
                            return (f?.nombre_display || f?.nombre || "Amigo").split(" ")[0]
                          }).join(", ")}
                        </span>
                        {hasRatings && (() => {
                          const vals = Object.values(plan.ratings).map(r => r.rating)
                          const avg = Math.round(vals.reduce((a,b) => a+b, 0) / vals.length)
                          return (
                            <div style={{ marginLeft: "auto", display: "flex", gap: 1 }}>
                              {[1,2,3,4,5].map(s => (
                                <span key={s} style={{ fontSize: 10, color: s <= avg ? "#ffd60a" : "rgba(255,255,255,0.1)" }}>★</span>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Open plans */}
        {openPlans.length > 0 && (
          <div style={{padding:"0 20px",marginBottom:8}}>
            {openPlans.map(plan => {
              const poster = getPoster(plan.movie_title)
              const hasPayer = !!plan.payer_name
              return (
                <div key={plan.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,marginBottom:10,overflow:"hidden"}}>
                  <div style={{display:"flex",gap:14,padding:12,alignItems:"center"}}>
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
                      {!hasPayer && (
                        <button onClick={() => onJoinPlan(plan.id)} style={{padding:"7px 18px",borderRadius:8,background:"rgba(255,59,59,0.1)",border:"1px solid rgba(255,59,59,0.25)",color:"#ff3b3b",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                          Apuntarme
                        </button>
                      )}
                    </div>
                  </div>
                  {hasPayer && (
                    <div style={{margin:"0 12px 12px",padding:"10px 14px",borderRadius:12,background:"rgba(255,165,0,0.08)",border:"1px solid rgba(255,165,0,0.2)"}}>
                      <p style={{margin:"0 0 8px",fontSize:12,color:"rgba(255,255,255,0.7)",lineHeight:1.5}}>
                        🎟️ <strong style={{color:"#ffb347"}}>{plan.payer_name}</strong> compra las entradas para este plan.
                      </p>
                      <button onClick={() => onJoinPlan(plan.id)} style={{padding:"8px 18px",borderRadius:8,background:"rgba(255,165,0,0.15)",border:"1px solid rgba(255,165,0,0.3)",color:"#ffb347",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        Entendido, me apunto!
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Matches activos (active negotiations) */}
        {activePlans.length > 0 && (
          <div style={{padding:"0 20px",marginBottom:8}}>
            <p style={{margin:"0 0 10px",fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Matches</p>
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

        {/* Quieren ver — horizontal poster scroll */}
        {friendSuggestions.length > 0 && (
          <div style={{marginBottom:12}}>
            <p style={{margin:"0 0 10px",padding:"0 20px",fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Tus amigos quieren ver</p>
            <div style={{display:"flex",gap:12,overflowX:"auto",padding:"0 20px",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
              {friendSuggestions.map(({ movieTitle, voters }) => {
                const poster = getPoster(movieTitle)
                return (
                  <div key={movieTitle} onClick={() => onVoyInline(movieTitle)} style={{flexShrink:0,width:120,position:"relative",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                    <div style={{width:120,height:180,borderRadius:14,overflow:"hidden",position:"relative",background:"linear-gradient(145deg,#1a1a1a,#111)"}}>
                      {poster && <img src={poster} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />}
                      <div style={{position:"absolute",inset:0,background:"linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)"}} />
                      <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"8px 10px"}}>
                        <p style={{margin:0,fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"#fff",lineHeight:1.2,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{movieTitle}</p>
                      </div>
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
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty plans state */}
        {!hasPlans && (
          <div style={{textAlign:"center",padding:"24px 24px 20px",animation:"fadeIn 0.6s ease"}}>
            <p style={{fontSize:36,margin:"0 0 8px"}}>🎬</p>
            <h3 style={{margin:"0 0 6px",fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:20,lineHeight:1,textTransform:"uppercase",letterSpacing:"-0.02em"}}>
              <span style={{WebkitTextStroke:"1px #fff",color:"transparent"}}>SIN </span>
              <span style={{color:"#ff3b3b"}}>PLANES</span>
            </h3>
            <p style={{color:"rgba(255,255,255,0.35)",fontSize:12,margin:"10px auto 16px",lineHeight:1.5,maxWidth:240}}>
              Haz swipe en la cartelera. Cuando coincidas con un amigo, se crea un plan.
            </p>
            <button onClick={onSwitchToCartelera} style={{padding:"10px 20px",borderRadius:12,background:"#ff3b3b",border:"none",color:"#000",fontSize:12,fontWeight:800,fontFamily:"'Archivo Black',sans-serif",cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.02em"}}>Ir a la cartelera</button>
          </div>
        )}


        {/* ═══════════════════════════════════════════ */}
        {/* SUB-TAB BAR (sticky)                        */}
        {/* ═══════════════════════════════════════════ */}
        <div style={{
          display:"flex", padding:"0", gap:0,
          borderTop:"1px solid rgba(255,255,255,0.06)",
          borderBottom:"1px solid rgba(255,255,255,0.06)",
          background:"#000",
          marginTop:4,
          position:"sticky", top:0, zIndex:10,
        }}>
          {[
            { id: "amigos", label: "Amigos", count: friends.length },
            { id: "personas", label: "Personas en VOSE" },
            { id: "pendientes", label: "Pendientes", count: pendingTotal },
          ].map(tab => (
            <button key={tab.id} onClick={() => setSubTab(tab.id)} style={{
              flex:1, padding:"12px 0", background:"none", border:"none",
              borderBottom: subTab === tab.id ? "2px solid #ff3b3b" : "2px solid transparent",
              color: subTab === tab.id ? "#fff" : "rgba(255,255,255,0.35)",
              fontSize:11, fontWeight:400, fontFamily:"'Archivo Black',sans-serif",
              textTransform:"uppercase", letterSpacing:"0.04em",
              cursor:"pointer", transition:"all 0.2s",
              position:"relative",
              WebkitTapHighlightColor:"transparent",
            }}>
              {tab.label}
              {/* Badge for pendientes */}
              {tab.id === "pendientes" && pendingIn.length > 0 && (
                <span style={{
                  position:"absolute", top:6, right:"15%",
                  width:16, height:16, borderRadius:"50%",
                  background:"#ff3b3b", color:"#fff",
                  fontSize:9, fontWeight:800,
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  {pendingIn.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── SUB-TAB: AMIGOS ─── */}
        {subTab === "amigos" && (
          <div style={{padding:"16px 20px"}}>
            {friends.length === 0 ? (
              <div style={{textAlign:"center",padding:"32px 16px",animation:"fadeIn 0.4s ease"}}>
                <p style={{fontSize:32,margin:"0 0 10px"}}>🍿</p>
                <p style={{margin:"0 0 16px",fontSize:13,color:"rgba(255,255,255,0.4)",lineHeight:1.5}}>
                  Aun no tienes amigos en VOSE. Invitalos para hacer planes de cine juntos.
                </p>
                <button onClick={handleShareInvite} style={{
                  padding:"12px 24px",borderRadius:14,
                  background:"#ff3b3b",border:"none",
                  color:"#000",fontSize:13,fontWeight:800,
                  fontFamily:"'Archivo Black',sans-serif",
                  cursor:"pointer",textTransform:"uppercase",
                  letterSpacing:"0.02em",
                  display:"inline-flex",alignItems:"center",gap:8,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Invitar amigos
                </button>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {friends.map(f => {
                  const name = f.nombre_display || f.nombre || "Usuario"
                  return (
                    <div key={f.id} onClick={() => setSelectedFriend(f)} style={{
                      display:"flex",alignItems:"center",gap:12,
                      background:"rgba(255,255,255,0.03)",
                      border:"1px solid rgba(255,255,255,0.07)",
                      borderRadius:14,padding:"10px 14px",
                      cursor:"pointer",transition:"all 0.2s",
                    }}>
                      <div style={{width:44,height:44,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#1a1a1a,#111)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"2px solid rgba(255,255,255,0.08)"}}>
                        {f.avatar_url ? (
                          <img src={f.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                        ) : (
                          <span style={{fontSize:16,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{name.charAt(0)}</span>
                        )}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{margin:0,fontSize:15,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}>
                        <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── SUB-TAB: PERSONAS EN VOSE ─── */}
        {subTab === "personas" && (
          <div style={{padding:"16px 20px"}}>
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

            {discoverPeople.length === 0 ? (
              <div style={{textAlign:"center",padding:"32px 16px"}}>
                <p style={{fontSize:32,margin:"0 0 10px"}}>🔍</p>
                <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.4)",lineHeight:1.5}}>
                  No hay personas nuevas por descubrir ahora mismo.
                </p>
              </div>
            ) : (
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
            )}
          </div>
        )}

        {/* ─── SUB-TAB: PENDIENTES ─── */}
        {subTab === "pendientes" && (
          <div style={{padding:"16px 20px"}}>
            {pendingTotal === 0 ? (
              <div style={{textAlign:"center",padding:"32px 16px"}}>
                <p style={{fontSize:32,margin:"0 0 10px"}}>✨</p>
                <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.4)",lineHeight:1.5}}>
                  No hay solicitudes pendientes.
                </p>
              </div>
            ) : (
              <>
                {/* Received requests */}
                {pendingIn.length > 0 && (
                  <div style={{marginBottom:20}}>
                    <p style={{margin:"0 0 10px",fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(52,199,89,0.8)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Recibidas</p>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {pendingIn.map(req => {
                        const name = req.nombre_display || req.nombre || "Usuario"
                        return (
                          <div key={req.friendshipId} style={{
                            display:"flex",alignItems:"center",gap:12,
                            background:"rgba(52,199,89,0.06)",
                            border:"1px solid rgba(52,199,89,0.15)",
                            borderRadius:14,padding:"10px 14px",
                            animation:"fadeIn 0.3s ease",
                          }}>
                            <div style={{width:40,height:40,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#1a1a1a,#111)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              {req.avatar_url ? (
                                <img src={req.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                              ) : (
                                <span style={{fontSize:15,fontWeight:700,color:"#fff"}}>{name.charAt(0)}</span>
                              )}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{margin:0,fontSize:14,fontWeight:600,color:"#fff"}}>{name}</p>
                              <p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.3)"}}>Quiere ser tu amigo</p>
                            </div>
                            <div style={{display:"flex",gap:6}}>
                              <button onClick={() => onAcceptFriend(req.friendshipId)} style={{padding:"7px 14px",borderRadius:10,background:"rgba(52,199,89,0.15)",border:"1px solid rgba(52,199,89,0.3)",color:"#34c759",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                                Aceptar
                              </button>
                              <button onClick={() => onRemoveFriend(req.friendshipId)} style={{padding:"7px 10px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.4)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                                ✕
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Sent requests */}
                {pendingOut.length > 0 && (
                  <div>
                    <p style={{margin:"0 0 10px",fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Enviadas</p>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {pendingOut.map(req => {
                        const name = req.nombre_display || req.nombre || "Usuario"
                        return (
                          <div key={req.friendshipId} style={{
                            display:"flex",alignItems:"center",gap:12,
                            background:"rgba(255,255,255,0.03)",
                            border:"1px solid rgba(255,255,255,0.07)",
                            borderRadius:14,padding:"10px 14px",
                          }}>
                            <div style={{width:36,height:36,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#1a1a1a,#111)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              {req.avatar_url ? (
                                <img src={req.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                              ) : (
                                <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>{name.charAt(0)}</span>
                              )}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{margin:0,fontSize:14,fontWeight:600,color:"rgba(255,255,255,0.6)"}}>{name}</p>
                            </div>
                            <span style={{fontSize:11,color:"rgba(255,255,255,0.25)",padding:"4px 10px",background:"rgba(255,255,255,0.04)",borderRadius:8}}>pendiente</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { isPlanPast } from '../../utils.js'
import PlanSheet from '../amigos/PlanSheet.jsx'
import PostCineCard from './PostCineCard.jsx'
import RecapCard from '../social/RecapCard.jsx'
import MemoryCard from '../social/MemoryCard.jsx'

/**
 * MiniConfetti — 10 confetti particles for "Me apunto, bro" button.
 */
function MiniConfetti() {
  const colors = ['#ff3b3b', '#34c759', '#ffd60a', '#ff9500', '#5ac8fa', '#fff']
  return (
    <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"visible",zIndex:10}}>
      <style>{`@keyframes confettiPop{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1}100%{transform:translate(var(--tx),var(--ty)) rotate(var(--tr)) scale(0);opacity:0}}`}</style>
      {Array.from({length:10}).map((_, i) => {
        const tx = (Math.random() - 0.5) * 80
        const ty = -30 - Math.random() * 60
        const tr = Math.random() * 720 - 360
        const size = 4 + Math.random() * 4
        return (
          <div key={i} style={{
            position:"absolute",left:"50%",top:"50%",
            width:size,height:size,borderRadius:Math.random()>0.5?"50%":1,
            background:colors[i % colors.length],
            "--tx":`${tx}px`,"--ty":`${ty}px`,"--tr":`${tr}deg`,
            animation:`confettiPop ${0.4 + Math.random()*0.3}s ease-out ${Math.random()*0.15}s forwards`,
          }} />
        )
      })}
    </div>
  )
}

/**
 * PlanCarousel — Horizontal scroll-snap carousel with parallax scale/opacity.
 * Spec: scroll-snap-type x mandatory, active card scale(1.02) + full opacity,
 * lateral cards scale(0.96) + opacity(0.5).
 */
function PlanCarousel({ plans, getPoster, friends, user, onSelect }) {
  const scrollRef = useRef(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const cardWidth = el.offsetWidth * 0.85
    const gap = 16
    const scrollCenter = el.scrollLeft + el.offsetWidth / 2
    let closest = 0
    let minDist = Infinity
    for (let i = 0; i < plans.length; i++) {
      const cardCenter = (cardWidth + gap) * i + cardWidth / 2 + (el.offsetWidth * 0.075)
      const dist = Math.abs(scrollCenter - cardCenter)
      if (dist < minDist) { minDist = dist; closest = i }
    }
    setActiveIdx(closest)
  }, [plans.length])

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{
        display:"flex",gap:16,overflowX:"auto",
        padding:`0 ${plans.length === 1 ? '20px' : 'calc((100% - 85%) / 2)'}`,
        scrollSnapType:"x mandatory",scrollbarWidth:"none",
        WebkitOverflowScrolling:"touch",marginBottom:12,
      }}
    >
      {plans.map((plan, i) => {
        const poster = getPoster(plan.movie_title)
        const isActive = i === activeIdx
        const dot = STATE_DOT.confirmed
        return (
          <div
            key={plan.id}
            onClick={() => onSelect(plan.id)}
            style={{
              flexShrink:0,width:plans.length === 1 ? "100%" : "85%",
              scrollSnapAlign:"center",
              position:"relative",borderRadius:18,overflow:"hidden",
              cursor:"pointer",height:180,
              border:`1px solid rgba(52,199,89,${isActive ? 0.3 : 0.15})`,
              transform:`scale(${isActive ? 1.02 : 0.96})`,
              opacity:isActive ? 1 : 0.5,
              boxShadow:isActive ? "0 8px 32px rgba(0,0,0,0.5)" : "none",
              transition:"transform 0.3s ease, opacity 0.3s ease, box-shadow 0.3s ease",
            }}
          >
            {poster && <img src={poster} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.4}} />}
            <div style={{position:"absolute",inset:0,background:"linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.3) 100%)"}} />
            <div style={{position:"relative",zIndex:1,height:"100%",padding:"14px 16px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:8,height:8,borderRadius:4,background:dot.color}} />
                  <span style={{fontSize:10,fontWeight:700,color:dot.color,textTransform:"uppercase",letterSpacing:"0.04em"}}>{dot.label}</span>
                </div>
                <CountdownBadge session={plan.chosen_session} />
              </div>
              <div>
                <p style={{margin:"0 0 4px",fontSize:18,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textShadow:"0 2px 8px rgba(0,0,0,0.5)"}}>{plan.movie_title}</p>
                {plan.chosen_session && (
                  <p style={{margin:"0 0 8px",fontSize:12,color:"rgba(255,255,255,0.55)"}}>
                    {plan.chosen_session.day || plan.chosen_session.date} · {plan.chosen_session.time} · {(plan.chosen_session.cinema || "").split(" ").slice(0,3).join(" ")}
                  </p>
                )}
                <div style={{display:"flex",alignItems:"center"}}>
                  {(plan.participants || []).slice(0, 4).map((pid, j) => {
                    const f = friends.find(fr => fr.id === pid)
                    const pp = (plan.participantProfiles || []).find(p => p.id === pid)
                    const isMe = pid === user?.id
                    const avatar = isMe ? user?.user_metadata?.avatar_url : (f?.avatar_url || pp?.avatar_url)
                    const name = isMe ? "Tu" : (f?.nombre_display || f?.nombre || pp?.nombre_display || pp?.nombre || "?")
                    return (
                      <div key={pid} style={{width:28,height:28,borderRadius:"50%",overflow:"hidden",marginLeft:j>0?-8:0,border:"2px solid rgba(0,0,0,0.6)",background:"linear-gradient(135deg, #1a1a1a, #111)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:4-j}}>
                        {avatar ? <img src={avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span style={{fontSize:10,fontWeight:700,color:"#fff"}}>{name.charAt(0)}</span>}
                      </div>
                    )
                  })}
                  <span style={{marginLeft:8,fontSize:11,color:"rgba(255,255,255,0.4)"}}>
                    {(plan.participants || []).map(pid => {
                      if (pid === user?.id) return "Tu"
                      const f = friends.find(fr => fr.id === pid)
                      return (f?.nombre_display || f?.nombre || "Amigo").split(" ")[0]
                    }).join(", ")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Countdown helper
function useCountdown(session) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000)
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

// State dot indicator
const STATE_DOT = {
  proposed:     { color: "rgba(255,255,255,0.45)", label: "Esperando al bro" },
  waiting_them: { color: "#c9a84c", label: "Negociando sesion" },
  pick_avail:   { color: "#c9a84c", label: "Negociando sesion" },
  waiting_pick: { color: "#c9a84c", label: "Negociando sesion" },
  pick_theirs:  { color: "#c9a84c", label: "Negociando sesion" },
  confirmed:    { color: "#34c759", label: "Plan cerrao" },
}

const STATE_LABELS = {
  proposed: "Propuesto",
  waiting_them: "Esperando...",
  pick_avail: "Marca fechas",
  waiting_pick: "Esperando...",
  pick_theirs: "Elige fecha",
}
const STATE_COLORS = {
  proposed: "#ff3b3b",
  waiting_them: "rgba(255,255,255,0.4)",
  pick_avail: "#ffd60a",
  waiting_pick: "rgba(255,255,255,0.4)",
  pick_theirs: "#ff3b3b",
}

export default function PlanesTab({
  user, profile, friends, plans, getMyState,
  onRespondYes, onRespondNo, onSendAvailability, onPickSession, onRejectAll,
  openPlans, onJoinPlan,
  friendSuggestions, onVoyInline,
  onSwitchToCartelera,
  isDemoMode, movies,
  onMarkWatched, onSavePayer, onShowShareCard, onSaveRating, onLeavePlan,
  vocitoState, onConnectWhatsApp, onUpdateProfile,
}) {
  const [activePlan, setActivePlan] = useState(null)
  const [vocitoNudgeDismissed, setVocitoNudgeDismissed] = useState(false)
  const [joinedPlanId, setJoinedPlanId] = useState(null)

  const getPoster = (title) => (movies || []).find(m => m.title === title)?.poster

  // Classify plans
  const confirmedPlans = plans.filter(p =>
    getMyState(p) === 'confirmed' && (!p.chosen_session || !isPlanPast(p.chosen_session))
  )
  const activePlans = plans.filter(p => {
    const s = getMyState(p)
    return s && s !== 'confirmed' && s !== 'no_match'
  })

  // Post-cine plans: confirmed, past, not yet rated by me
  const postCinePlans = plans.filter(p => {
    if (getMyState(p) !== 'confirmed') return false
    if (!p.chosen_session || !isPlanPast(p.chosen_session)) return false
    const watched = profile?.watched || []
    return !watched.some(w => w.title === p.movie_title)
  })

  // Memory-ready plans: confirmed, past 48h, 2+ ratings, no memory_card dismissed
  const memoryPlans = plans.filter(p => {
    if (getMyState(p) !== 'confirmed') return false
    if (!p.chosen_session || !isPlanPast(p.chosen_session)) return false
    const ratings = p.ratings || {}
    const ratedCount = Object.values(ratings).filter(r => r?.rating != null).length
    return ratedCount >= 2
  })

  // Combine "my plans" = confirmed (future) + active negotiations
  const myPlans = [...confirmedPlans, ...activePlans]

  const hasContent = postCinePlans.length > 0 || myPlans.length > 0 || openPlans.length > 0 || friendSuggestions.length > 0

  // Handle post-cine rating
  function handlePostCineRate(plan, rating) {
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
    onMarkWatched(plan.movie_title, rating, planContext)
    if (onSaveRating) onSaveRating(plan.id, rating)
  }

  // PlanSheet overlay
  if (activePlan) {
    const plan = plans.find(p => p.id === activePlan) || [...(openPlans||[])].find(p => p.id === activePlan)
    if (plan) {
      const partnerName = plan.partner?.nombre_display || plan.partner?.nombre || "Amigo"
      return (
        <div style={{position:"relative",height:"100%"}}>
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
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
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

        {/* RECAP — monthly recap card */}
        <RecapCard
          profile={profile}
          user={user}
          plans={plans}
          friends={friends}
          myVotes={{}}
          isDemoMode={isDemoMode}
          movies={movies}
          onUpdateProfile={onUpdateProfile}
        />

        {/* POST-CINE — top priority */}
        {postCinePlans.map(plan => (
          <PostCineCard
            key={`postcine-${plan.id}`}
            plan={plan}
            friends={friends}
            user={user}
            posterUrl={getPoster(plan.movie_title)}
            onRate={handlePostCineRate}
          />
        ))}

        {/* MEMORY CARDS — plans with 2+ ratings */}
        {memoryPlans.map(plan => (
          <MemoryCard
            key={`memory-${plan.id}`}
            plan={plan}
            friends={friends}
            user={user}
            posterUrl={getPoster(plan.movie_title)}
            isDemoMode={isDemoMode}
          />
        ))}

        {/* TUS PLANES — confirmed + active negotiations */}
        {myPlans.length > 0 && (
          <div style={{marginBottom:12}}>
            {confirmedPlans.length > 0 && activePlans.length > 0 && (
              <p style={{margin:"0 0 10px",padding:"0 20px",fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Tus planes</p>
            )}

            {/* Confirmed plans — horizontal carousel with scroll-snap */}
            {confirmedPlans.length > 0 && (
              <PlanCarousel plans={confirmedPlans} getPoster={getPoster} friends={friends} user={user} onSelect={setActivePlan} />
            )}

            {/* Active negotiations */}
            {activePlans.map(plan => {
              const state = getMyState(plan)
              const dot = STATE_DOT[state] || { color: "#fff", label: state }
              const partnerName = plan.partner?.nombre_display || plan.partner?.nombre || "Amigo"
              const isWaiting = state === 'waiting_them' || state === 'waiting_pick'
              const poster = getPoster(plan.movie_title)
              return (
                <div key={plan.id} onClick={() => !isWaiting && setActivePlan(plan.id)} style={{display:"flex",gap:14,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:12,marginBottom:10,alignItems:"center",cursor:isWaiting?"default":"pointer",transition:"all 0.2s"}}>
                  <div style={{width:56,height:84,borderRadius:10,overflow:"hidden",flexShrink:0,background:"linear-gradient(145deg,#1a1a1a,#111)",position:"relative"}}>
                    {poster && <img src={poster} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />}
                    {/* State dot overlay */}
                    <div style={{position:"absolute",bottom:4,right:4,width:10,height:10,borderRadius:5,background:dot.color,border:"2px solid rgba(0,0,0,0.6)"}} />
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                      <p style={{margin:"0 0 4px",fontSize:15,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>{plan.movie_title}</p>
                      <span style={{fontSize:10,fontWeight:700,color:STATE_COLORS[state]||"#fff",background:"rgba(255,255,255,0.06)",borderRadius:8,padding:"3px 8px",flexShrink:0,whiteSpace:"nowrap"}}>
                        {STATE_LABELS[state] || state}
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

        {/* PLANES DE TU SQUAD — open plans from friends */}
        {openPlans.length > 0 && (
          <div style={{padding:"0 20px",marginBottom:12}}>
            <p style={{margin:"0 0 10px",fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Planes de tu squad</p>
            {openPlans.map(plan => {
              const poster = getPoster(plan.movie_title)
              const hasPayer = !!plan.payer_name
              return (
                <div key={plan.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,marginBottom:10,overflow:"hidden"}}>
                  <div style={{display:"flex",gap:14,padding:12,alignItems:"center"}}>
                    <div style={{width:56,height:84,borderRadius:10,overflow:"hidden",flexShrink:0,background:"linear-gradient(145deg,#1a1a1a,#111)"}}>
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
                        <div style={{position:"relative",display:"inline-block"}}>
                          <button onClick={(e) => {
                            e.stopPropagation()
                            setJoinedPlanId(plan.id)
                            onJoinPlan(plan.id)
                            setTimeout(() => setJoinedPlanId(null), 2000)
                          }} style={{
                            padding:"7px 18px",borderRadius:8,
                            background:joinedPlanId === plan.id ? "rgba(52,199,89,0.15)" : "rgba(255,59,59,0.1)",
                            border:`1px solid ${joinedPlanId === plan.id ? "rgba(52,199,89,0.3)" : "rgba(255,59,59,0.25)"}`,
                            color:joinedPlanId === plan.id ? "#34c759" : "#ff3b3b",
                            fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                            transform:joinedPlanId === plan.id ? "scale(1)" : undefined,
                            transition:"all 0.3s ease",
                          }}>
                            {joinedPlanId === plan.id ? "Te has apuntao" : "Me apunto, bro"}
                          </button>
                          {joinedPlanId === plan.id && <MiniConfetti />}
                        </div>
                      )}
                    </div>
                  </div>
                  {hasPayer && (
                    <div style={{margin:"0 12px 12px",padding:"10px 14px",borderRadius:12,background:"rgba(255,165,0,0.08)",border:"1px solid rgba(255,165,0,0.2)"}}>
                      <p style={{margin:"0 0 8px",fontSize:12,color:"rgba(255,255,255,0.7)",lineHeight:1.5}}>
                        🎟️ <strong style={{color:"#ffb347"}}>{plan.payer_name}</strong> compra las entradas.
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

        {/* SEMILLAS — "Tu gente quiere ver esto" */}
        {friendSuggestions.length > 0 && (
          <div style={{marginBottom:12}}>
            <p style={{margin:"0 0 10px",padding:"0 20px",fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Tu gente quiere ver esto</p>
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
                            {v.avatar_url ? <img src={v.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span style={{fontSize:9,fontWeight:700,color:"#fff"}}>{v.name.charAt(0)}</span>}
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

        {/* VOCITO nudge — only if never connected */}
        {vocitoState === 'never_connected' && !vocitoNudgeDismissed && !isDemoMode && (
          <div style={{margin:"0 20px 16px",borderRadius:14,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",padding:"14px 16px",display:"flex",alignItems:"flex-start",gap:12,animation:"fadeIn 0.4s ease"}}>
            <span style={{fontSize:20,lineHeight:1,flexShrink:0}}>🤖</span>
            <div style={{flex:1,minWidth:0}}>
              <p style={{margin:"0 0 8px",fontSize:13,color:"rgba(255,255,255,0.7)",lineHeight:1.5}}>
                Chacho, conecta WhatsApp o te vas a enterar de los planes por telepatia.
              </p>
              <button onClick={onConnectWhatsApp} style={{padding:"8px 16px",borderRadius:10,background:"rgba(52,199,89,0.12)",border:"1px solid rgba(52,199,89,0.25)",color:"#34c759",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                Conectar VOCITO →
              </button>
            </div>
            <button onClick={() => setVocitoNudgeDismissed(true)} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:"rgba(255,255,255,0.25)",fontSize:16,lineHeight:1}}>✕</button>
          </div>
        )}

        {/* Empty state */}
        {!hasContent && (
          <div style={{textAlign:"center",padding:"60px 24px 20px",animation:"fadeIn 0.6s ease"}}>
            {friends.length === 0 ? (
              <>
                <p style={{fontSize:48,margin:"0 0 12px"}}>🍿</p>
                <h3 style={{margin:"0 0 8px",fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:18,color:"#fff",textTransform:"uppercase"}}>
                  Aqui no se mueve nadie
                </h3>
                <p style={{color:"rgba(255,255,255,0.35)",fontSize:13,margin:"0 auto 20px",lineHeight:1.6,maxWidth:260}}>
                  Swipea una peli y haz match con alguien de tu squad.
                </p>
              </>
            ) : (
              <>
                <p style={{fontSize:48,margin:"0 0 12px"}}>🏜️</p>
                <h3 style={{margin:"0 0 8px",fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:16,color:"#fff",lineHeight:1.3}}>
                  Mas parao que un domingo en Fuerteventura
                </h3>
                <p style={{color:"rgba(255,255,255,0.35)",fontSize:13,margin:"0 auto 20px",lineHeight:1.6,maxWidth:280}}>
                  Tu squad tiene {friends.length} persona{friends.length !== 1 ? "s" : ""} y ninguna se mueve. Chacho, dale al swipe y monta algo.
                </p>
              </>
            )}
            <button onClick={onSwitchToCartelera} style={{padding:"12px 24px",borderRadius:14,background:"#ff3b3b",border:"none",color:"#000",fontSize:13,fontWeight:800,fontFamily:"'Archivo Black',sans-serif",cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.02em"}}>
              Ir a Cartelera
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

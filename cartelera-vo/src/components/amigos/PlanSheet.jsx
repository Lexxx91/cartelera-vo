import { useState, useEffect, useRef } from 'react'
import { getAllSessionsForMovie, sKey, isPlanPast } from '../../utils.js'
import RouletteWheel from './RouletteWheel.jsx'

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
  if (emails.length > 0) params.set('add', emails.join(','))
  window.open(`https://calendar.google.com/calendar/r/eventedit?${params.toString()}`, '_blank')
}

// Countdown helper
function formatCountdown(session) {
  if (!session?.date || !session?.time) return null
  const [year, month, day] = session.date.split("-").map(Number)
  const [hours, minutes] = (session.time || "00:00").split(":").map(Number)
  if (!year) return null
  const target = new Date(year, month - 1, day, hours || 0, minutes || 0).getTime()
  const diff = target - Date.now()
  if (diff <= 0) return null
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (days > 0) return `${days}d ${hrs}h`
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

// Inline star rating picker
function RatingPicker({ onRate }) {
  const [val, setVal] = useState(0)
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 4 }}>
      {[1,2,3,4,5].map(s => (
        <button key={s} onClick={() => setVal(s)} style={{
          background: "none", border: "none", cursor: "pointer", padding: 2,
          fontSize: 22, color: s <= val ? "#ffd60a" : "rgba(255,255,255,0.12)",
          transition: "all 0.15s", transform: s <= val ? "scale(1.1)" : "scale(1)",
        }}>
          ★
        </button>
      ))}
      {val > 0 && (
        <button onClick={() => onRate(val)} style={{
          marginLeft: 8, padding: "5px 16px", borderRadius: 8,
          background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.3)",
          color: "#ff3b3b", fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          OK
        </button>
      )}
    </div>
  )
}

// Time ago helper
function timeAgo(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 0) return null
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "hace un momento"
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `hace ${days}d`
}

export default function PlanSheet({ plan, myState, partnerName, onRespondYes, onRespondNo, onSendAvailability, onPickSession, onRejectAll, onClose, user, friends, onSavePayer, posterUrl, onShare, onSaveRating, onLeavePlan }) {
  const [allSessions, setAllSessions] = useState([])
  const [myAvail, setMyAvail] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [showRoulette, setShowRoulette] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const sheetRef = useRef(null)
  const prevStateRef = useRef(myState)

  // Celebration when plan gets confirmed
  useEffect(() => {
    if (prevStateRef.current !== 'confirmed' && myState === 'confirmed') {
      setShowCelebration(true)
      navigator.vibrate?.([20, 50, 20, 50, 20])
      setTimeout(() => setShowCelebration(false), 3000)
    }
    prevStateRef.current = myState
  }, [myState])

  // Scroll sheet to top when showing roulette
  useEffect(() => {
    if (showRoulette && sheetRef.current) {
      sheetRef.current.scrollTop = 0
    }
  }, [showRoulette])

  // Load all sessions when entering pick_avail
  useEffect(() => {
    if (myState === 'pick_avail') {
      setLoadingSessions(true)
      getAllSessionsForMovie(plan.movie_title).then(s => {
        setAllSessions(s)
        setLoadingSessions(false)
      })
    }
  }, [myState, plan.movie_title])

  function toggleAvail(s) {
    const k = sKey(s)
    setMyAvail(prev => prev.find(x => sKey(x) === k) ? prev.filter(x => sKey(x) !== k) : [...prev, s])
  }
  function isMarked(s) { return !!myAvail.find(x => sKey(x) === sKey(s)) }

  const amIInitiator = plan.amIInitiator
  const isThirdParty = !amIInitiator && plan.partner_id !== user?.id // joined via "Apuntarme", not initiator or partner
  const theirAvail = amIInitiator ? (plan.partner_availability || []) : (plan.initiator_availability || [])
  const proposed = plan.proposed_session
  const chosen = plan.chosen_session

  // Build participant list (used by avatars section + roulette)
  const allParticipants = []
  if (user) {
    allParticipants.push({
      id: user?.id,
      name: user?.user_metadata?.full_name || 'Tu',
      avatar_url: user?.user_metadata?.avatar_url || null,
    })
  }
  ;(plan.participants || []).forEach(pid => {
    if (pid === user?.id) return
    const friend = (friends || []).find(f => f.id === pid)
    if (friend) {
      allParticipants.push({ id: pid, name: friend.nombre_display || friend.nombre, avatar_url: friend.avatar_url })
    } else if (plan.partner && pid === plan.partner?.id) {
      allParticipants.push({ id: pid, name: plan.partner.nombre_display || plan.partner.nombre || partnerName, avatar_url: plan.partner.avatar_url })
    } else {
      allParticipants.push({ id: pid, name: 'Participante', avatar_url: null })
    }
  })
  if (allParticipants.length < 2 && plan.partner) {
    allParticipants.push({ id: plan.partner.id, name: plan.partner.nombre_display || plan.partner.nombre || partnerName, avatar_url: plan.partner.avatar_url })
  }

  // Partner names for subtitle
  const otherNames = allParticipants.filter(p => p.id !== user?.id).map(p => p.name.split(" ")[0]).join(", ")

  const past = chosen ? isPlanPast(chosen) : false
  const countdown = chosen ? formatCountdown(chosen) : null

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "#000",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      animation: "fadeIn 0.3s ease",
    }}>
      {/* Celebration confetti */}
      {showCelebration && (
        <>
          <style>{`
            @keyframes confettiFall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
          `}</style>
          <div style={{ position: "absolute", inset: 0, zIndex: 300, pointerEvents: "none", overflow: "hidden" }}>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} style={{
                position: "absolute",
                left: `${Math.random() * 100}%`,
                top: 0,
                width: Math.random() * 8 + 4,
                height: Math.random() * 8 + 4,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                background: ["#ff3b3b", "#ffd60a", "#34c759", "#4fc3f7", "#ff9500", "#fff"][i % 6],
                animation: `confettiFall ${1.5 + Math.random() * 2}s ease-in ${Math.random() * 0.5}s forwards`,
              }} />
            ))}
          </div>
        </>
      )}
      {/* Poster background */}
      {posterUrl && (
        <img src={posterUrl} alt="" style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          opacity: past ? 0.2 : 0.45,
          filter: past ? "grayscale(0.6)" : "none",
          transition: "all 0.3s",
        }} />
      )}

      {/* Gradient overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.88) 30%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.25) 100%)",
      }} />

      {/* Top bar */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 20px",
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          width: 38, height: 38, borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#fff", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        {/* VOSE badge */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 16, color: "#fff", letterSpacing: "0.02em" }}>VO</span>
          <span style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 16, color: "rgba(255,255,255,0.35)" }}>SE</span>
        </div>
      </div>

      {/* Scrollable content — pushed to bottom */}
      <div ref={sheetRef} style={{
        position: "relative", zIndex: 2,
        flex: 1, overflowY: "auto",
        display: "flex", flexDirection: "column",
        justifyContent: "flex-end",
        padding: "0 24px 44px",
      }}>
        {/* Movie title + subtitle */}
        <h1 style={{
          margin: "0 0 4px",
          fontSize: 26, fontWeight: 400,
          fontFamily: "'Archivo Black', sans-serif",
          color: "#fff",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          textShadow: "0 2px 12px rgba(0,0,0,0.5)",
          lineHeight: 1.1,
        }}>
          {plan.movie_title}
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          Plan con {otherNames}
        </p>

        {/* Participant avatars */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          {allParticipants.map((p, i) => (
            <div key={p.id || i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                overflow: "hidden",
                background: "linear-gradient(135deg, #1a1a1a, #111)",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid rgba(255,255,255,0.15)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}>
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>
                {p.id === user?.id ? "Tu" : p.name.split(" ")[0]}
              </span>
            </div>
          ))}
        </div>

        {/* === STATE-SPECIFIC CONTENT === */}

        {/* PROPOSED — show initiator's availability for partner to pick */}
        {myState === "proposed" && proposed && (
          <>
            {theirAvail && theirAvail.length > 1 ? (
              /* NEW FLOW: Other person sent multiple sessions → pick one */
              <>
                <p style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 6px"}}>
                  {partnerName.split(" ")[0]} puede en
                </p>
                <p style={{fontSize:12,color:"rgba(255,255,255,0.35)",margin:"0 0 16px",lineHeight:1.5}}>
                  Toca la que mejor te venga. El plan se confirma al instante.
                </p>
                {(() => {
                  const byDay = {}
                  theirAvail.forEach(s => { if (!byDay[s.day || s.date]) byDay[s.day || s.date] = []; byDay[s.day || s.date].push(s) })
                  return Object.entries(byDay).map(([day, slots]) => (
                    <div key={day} style={{marginBottom:14}}>
                      <p style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.6)",margin:"0 0 8px"}}>{day}</p>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {slots.map(s => (
                          <button key={sKey(s)} onClick={() => onPickSession(s)} style={{
                            width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
                            padding:"14px 18px",borderRadius:14,
                            background:"rgba(255,255,255,0.05)",
                            border:"1px solid rgba(255,255,255,0.09)",
                            textAlign:"left",cursor:"pointer",fontFamily:"inherit",
                            transition:"all 0.15s",
                          }}>
                            <div>
                              <p style={{margin:"0 0 2px",fontSize:17,fontWeight:700,color:"#fff"}}>{s.time}</p>
                              <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.4)"}}>📍 {s.cinema}</p>
                            </div>
                            <span style={{fontSize:20,color:"rgba(255,255,255,0.25)"}}>›</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                })()}
                <button onClick={onRejectAll} style={{
                  width:"100%",marginTop:4,padding:13,borderRadius:13,
                  background:"transparent",border:"1px solid rgba(255,69,58,0.2)",
                  color:"rgba(255,69,58,0.55)",fontSize:13,fontWeight:600,
                  cursor:"pointer",fontFamily:"inherit",
                }}>
                  Ninguna me viene bien
                </button>
              </>
            ) : (
              /* LEGACY/SINGLE: Just one proposed session → yes/no buttons */
              <>
                <p style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 14px"}}>Mejor opcion disponible</p>
                <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:18,padding:20,marginBottom:20,textAlign:"center"}}>
                  <p style={{fontSize:28,fontWeight:800,color:"#fff",margin:"0 0 4px"}}>{proposed.day || proposed.date}</p>
                  <p style={{fontSize:40,fontWeight:800,color:"#fff",letterSpacing:"-2px",margin:"0 0 8px",lineHeight:1}}>{proposed.time}</p>
                  <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:0}}>📍 {proposed.cinema}</p>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={onRespondNo} style={{flex:1,padding:16,borderRadius:14,background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.55)",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>No puedo</button>
                  <button onClick={onRespondYes} style={{flex:2,padding:16,borderRadius:14,background:"#fff",color:"#000",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit",border:"none"}}>Me cuadra y me sabe ✓</button>
                </div>
              </>
            )}
          </>
        )}

        {/* WAITING_THEM */}
        {myState === "waiting_them" && (
          <div style={{textAlign:"center",padding:"32px 0"}}>
            <p style={{fontSize:40,margin:"0 0 14px"}}>⏳</p>
            <p style={{fontSize:15,fontWeight:600,color:"#fff",margin:"0 0 6px"}}>Esperando a {partnerName}...</p>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.35)",margin:"0 0 12px"}}>Le hemos enviado la propuesta. Te avisaremos cuando responda.</p>
            {plan.updated_at && timeAgo(plan.updated_at) && (
              <p style={{fontSize:11,color:"rgba(255,255,255,0.15)",margin:0}}>Actualizado {timeAgo(plan.updated_at)}</p>
            )}
          </div>
        )}

        {/* PICK_AVAIL */}
        {myState === "pick_avail" && (
          <>
            <p style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 4px"}}>Que dias puedes?</p>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.35)",margin:"0 0 18px",lineHeight:1.6}}>Marca todas las opciones que te vienen bien. {partnerName.split(" ")[0]} elegira la que mejor le encaje.</p>
            {loadingSessions ? (
              <div style={{textAlign:"center",padding:"24px 0"}}>
                <div style={{width:24,height:24,border:"2px solid rgba(255,255,255,0.1)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite",margin:"0 auto"}} />
                <p style={{margin:"10px 0 0",fontSize:12,color:"rgba(255,255,255,0.35)"}}>Cargando sesiones...</p>
              </div>
            ) : (
              <>
                {(() => {
                  const byDay = {}
                  allSessions.forEach(s => { if (!byDay[s.day || s.date]) byDay[s.day || s.date] = []; byDay[s.day || s.date].push(s) })
                  return Object.entries(byDay).map(([day, slots]) => (
                    <div key={day} style={{marginBottom:14}}>
                      <p style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.4)",margin:"0 0 8px"}}>{day}</p>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {slots.map(s => {
                          const sel = isMarked(s)
                          return (
                            <button key={sKey(s)} onClick={() => toggleAvail(s)} style={{padding:"9px 16px",borderRadius:11,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.18s",background:sel?"rgba(255,59,59,0.15)":"rgba(255,255,255,0.06)",color:sel?"#ff3b3b":"rgba(255,255,255,0.5)",border:sel?"1.5px solid rgba(255,59,59,0.4)":"1px solid rgba(255,255,255,0.09)"}}>
                              {sel && "✓ "}{s.time}
                              <span style={{display:"block",fontSize:10,marginTop:1,color:sel?"rgba(255,59,59,0.6)":"rgba(255,255,255,0.22)"}}>{s.cinema.split(" ")[0]}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))
                })()}
                <button onClick={() => onSendAvailability(myAvail)} disabled={!myAvail.length} style={{width:"100%",marginTop:8,padding:15,borderRadius:13,fontSize:15,fontWeight:700,cursor:myAvail.length?"pointer":"not-allowed",fontFamily:"inherit",background:myAvail.length?"#fff":"rgba(255,255,255,0.07)",color:myAvail.length?"#000":"rgba(255,255,255,0.2)",border:"none"}}>
                  Enviar disponibilidad a {partnerName.split(" ")[0]}
                </button>
              </>
            )}
          </>
        )}

        {/* WAITING_PICK */}
        {myState === "waiting_pick" && (
          <div style={{textAlign:"center",padding:"32px 0"}}>
            <p style={{fontSize:40,margin:"0 0 14px"}}>⏳</p>
            <p style={{fontSize:15,fontWeight:600,color:"#fff",margin:"0 0 6px"}}>Esperando a {partnerName}...</p>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.35)",margin:"0 0 12px"}}>Le hemos enviado tus fechas. {partnerName.split(" ")[0]} elegira la que mejor le venga.</p>
            {plan.updated_at && timeAgo(plan.updated_at) && (
              <p style={{fontSize:11,color:"rgba(255,255,255,0.15)",margin:0}}>Actualizado {timeAgo(plan.updated_at)}</p>
            )}
          </div>
        )}

        {/* PICK_THEIRS — partner sent availability, I pick one */}
        {myState === "pick_theirs" && (
          <>
            <p style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 6px"}}>
              {partnerName.split(" ")[0]} puede en
            </p>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.35)",margin:"0 0 16px",lineHeight:1.5}}>
              Toca la que mejor te venga. El plan se confirma al instante.
            </p>
            {(() => {
              const byDay = {}
              theirAvail.forEach(s => { if (!byDay[s.day || s.date]) byDay[s.day || s.date] = []; byDay[s.day || s.date].push(s) })
              return Object.entries(byDay).map(([day, slots]) => (
                <div key={day} style={{marginBottom:14}}>
                  <p style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.6)",margin:"0 0 8px"}}>{day}</p>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {slots.map(s => (
                      <button key={sKey(s)} onClick={() => onPickSession(s)} style={{
                        width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
                        padding:"14px 18px",borderRadius:14,
                        background:"rgba(255,255,255,0.05)",
                        border:"1px solid rgba(255,255,255,0.09)",
                        textAlign:"left",cursor:"pointer",fontFamily:"inherit",
                        transition:"all 0.15s",
                      }}>
                        <div>
                          <p style={{margin:"0 0 2px",fontSize:17,fontWeight:700,color:"#fff"}}>{s.time}</p>
                          <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.4)"}}>📍 {s.cinema}</p>
                        </div>
                        <span style={{fontSize:20,color:"rgba(255,255,255,0.25)"}}>›</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            })()}
            <button onClick={onRejectAll} style={{
              width:"100%",marginTop:4,padding:13,borderRadius:13,
              background:"transparent",border:"1px solid rgba(255,69,58,0.2)",
              color:"rgba(255,69,58,0.55)",fontSize:13,fontWeight:600,
              cursor:"pointer",fontFamily:"inherit",
            }}>
              Ninguna me viene bien
            </button>
          </>
        )}

        {/* CONFIRMED */}
        {myState === "confirmed" && chosen && !showRoulette && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            {/* Session info card */}
            <div style={{
              background: "rgba(255,59,59,0.08)",
              border: "1px solid rgba(255,59,59,0.2)",
              borderRadius: 18, padding: 20,
              marginBottom: 16,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#ff3b3b", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px", textAlign: "center" }}>
                {past ? "Plan completado" : "Plan confirmado"} ✓
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: countdown ? 14 : 0, justifyContent: "center" }}>
                <span style={{ fontSize: 22 }}>📅</span>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>
                    {chosen.day || chosen.date} · {chosen.time}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                    📍 {chosen.cinema}
                  </p>
                </div>
              </div>

              {/* Countdown */}
              {countdown && (
                <div style={{
                  background: "rgba(255,59,59,0.12)", borderRadius: 14,
                  padding: "12px 16px", textAlign: "center", marginTop: 4,
                }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "rgba(255,59,59,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Quedan
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 28, fontWeight: 400, fontFamily: "'Archivo Black',sans-serif", color: "#ff3b3b" }}>
                    {countdown}
                  </p>
                </div>
              )}

              {/* Payer */}
              {plan.payer_name && (
                <p style={{ margin: "14px 0 0", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
                  🎰 Compra las entradas: <strong style={{ color: "#ff3b3b" }}>{plan.payer_name}</strong>
                </p>
              )}
            </div>

            {/* Action buttons */}
            {!past && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => addToCalendar(plan.movie_title, chosen, [plan.partner?.email, user?.email].filter(Boolean))} style={{
                  width: "100%", padding: "14px 24px", borderRadius: 14,
                  background: "#ff3b3b", border: "none",
                  color: "#000", fontSize: 14, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#000" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="#000" strokeWidth="2" strokeLinecap="round"/></svg>
                  Añadir al calendario
                </button>
                {onShare && (
                  <button onClick={onShare} style={{
                    width: "100%", padding: "14px 24px", borderRadius: 14,
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Compartir plan
                  </button>
                )}
                {!plan.payer_name && !isThirdParty && (
                  <button onClick={() => setShowRoulette(true)} style={{
                    width: "100%", padding: "14px 24px", borderRadius: 14,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                    🎰 ¿Quien compra las entradas?
                  </button>
                )}
                {/* Third-party participant: show payer info + leave button */}
                {isThirdParty && plan.payer_name && (
                  <div style={{
                    padding:"12px 16px",borderRadius:14,
                    background:"rgba(255,165,0,0.08)",border:"1px solid rgba(255,165,0,0.2)",
                    marginBottom:10,textAlign:"center",
                  }}>
                    <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.7)",lineHeight:1.5}}>
                      🎟️ <strong style={{color:"#ffb347"}}>{plan.payer_name}</strong> compra las entradas. Pregúntale si ya las compró para saber si comprar la tuya.
                    </p>
                  </div>
                )}
                {isThirdParty && onLeavePlan && (
                  <button onClick={onLeavePlan} style={{
                    width: "100%", padding: "14px 24px", borderRadius: 14,
                    background: "rgba(255,69,58,0.06)",
                    border: "1px solid rgba(255,69,58,0.15)",
                    color: "rgba(255,69,58,0.6)", fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                    Salir del plan
                  </button>
                )}
              </div>
            )}

            {/* POST-MOVIE: Ratings section */}
            {past && (
              <div style={{ animation: "fadeIn 0.4s ease" }}>
                <p style={{
                  margin: "0 0 16px", fontSize: 11, fontWeight: 700,
                  color: "rgba(255,255,255,0.3)", textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}>
                  Valoraciones
                </p>

                {allParticipants.map((p, i) => {
                  const pid = p.id
                  const rating = plan.ratings?.[pid]
                  const isMe = pid === user?.id
                  const hasRated = !!rating

                  return (
                    <div key={pid || i} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 0",
                      borderBottom: i < allParticipants.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%",
                        overflow: "hidden", background: "linear-gradient(135deg,#1a1a1a,#111)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: "2px solid rgba(255,255,255,0.1)", flexShrink: 0,
                      }}>
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{p.name.charAt(0)}</span>
                        )}
                      </div>

                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#fff" }}>
                          {isMe ? "Tu" : p.name}
                        </p>
                        {hasRated ? (
                          <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
                            {[1,2,3,4,5].map(s => (
                              <span key={s} style={{ fontSize: 15, color: s <= rating.rating ? "#ffd60a" : "rgba(255,255,255,0.1)" }}>★</span>
                            ))}
                          </div>
                        ) : isMe && onSaveRating ? (
                          <RatingPicker onRate={(val) => onSaveRating(val)} />
                        ) : (
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>Pendiente</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ROULETTE — with ALL participants */}
        {myState === "confirmed" && showRoulette && (
          <RouletteWheel
            participants={allParticipants.map(p => ({ name: p.name, avatar_url: p.avatar_url }))}
            onDone={(winnerName) => {
              if (onSavePayer) onSavePayer(winnerName)
              setShowRoulette(false)
            }}
          />
        )}

        {/* NO_MATCH */}
        {myState === "no_match" && (
          <div style={{textAlign:"center",padding:"32px 0 16px"}}>
            <p style={{fontSize:36,margin:"0 0 16px"}}>😔</p>
            <p style={{fontSize:16,fontWeight:700,color:"#fff",margin:"0 0 8px"}}>Sin fechas en comun</p>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.35)",lineHeight:1.7,margin:"0 0 28px"}}>No hay ninguna sesion que os venga bien a los dos.</p>
            <button onClick={onClose} style={{padding:"13px 28px",borderRadius:100,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  )
}

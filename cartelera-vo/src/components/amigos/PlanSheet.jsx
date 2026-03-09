import { useState, useEffect, useRef } from 'react'
import { getAllSessionsForMovie, sKey } from '../../utils.js'
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
  // Add invitees if available
  const emails = (inviteeEmails || []).filter(Boolean)
  if (emails.length > 0) {
    params.set('add', emails.join(','))
  }
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

export default function PlanSheet({ plan, myState, partnerName, onRespondYes, onRespondNo, onSendAvailability, onPickSession, onRejectAll, onClose, user, friends, onSavePayer }) {
  const [allSessions, setAllSessions] = useState([])
  const [myAvail, setMyAvail] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [showRoulette, setShowRoulette] = useState(false)
  const sheetRef = useRef(null)

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

  // Get partner's availability
  const amIInitiator = plan.amIInitiator
  const theirAvail = amIInitiator ? (plan.partner_availability || []) : (plan.initiator_availability || [])

  const proposed = plan.proposed_session
  const chosen = plan.chosen_session

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.72)"}} />
      <div ref={sheetRef} style={{position:"relative",background:"#111",borderRadius:"24px 24px 0 0",border:"1px solid rgba(255,255,255,0.08)",padding:"0 20px 44px",maxHeight:"85vh",overflowY:"auto",marginBottom:0}}>
        <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)",margin:"12px auto 20px"}} />

        {/* Header */}
        <div style={{marginBottom:20,paddingBottom:16,borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
          <p style={{fontSize:20,fontWeight:900,fontFamily:"'Moniqa','DM Sans',sans-serif",color:"#fff",margin:"0 0 4px"}}>{plan.movie_title}</p>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.35)",margin:0}}>Plan con {partnerName}</p>
        </div>

        {/* PROPOSED */}
        {myState === "proposed" && proposed && (
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

        {/* WAITING_THEM */}
        {myState === "waiting_them" && (
          <div style={{textAlign:"center",padding:"32px 0"}}>
            <p style={{fontSize:40,margin:"0 0 14px"}}>⏳</p>
            <p style={{fontSize:15,fontWeight:600,color:"#fff",margin:"0 0 6px"}}>Esperando a {partnerName}...</p>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.35)",margin:0}}>Le hemos enviado la propuesta. Te avisaremos cuando responda.</p>
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
            <p style={{fontSize:13,color:"rgba(255,255,255,0.35)",margin:0}}>Le hemos enviado tus fechas. {partnerName.split(" ")[0]} elegira la que mejor le venga.</p>
          </div>
        )}

        {/* PICK_THEIRS */}
        {myState === "pick_theirs" && (
          <>
            <p style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 4px"}}>{partnerName.split(" ")[0]} puede en estas fechas</p>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.35)",margin:"0 0 18px",lineHeight:1.6}}>Elige la que mejor te venga. El plan se confirma al instante.</p>
            {theirAvail.map(s => (
              <button key={sKey(s)} onClick={() => onPickSession(s)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:16,borderRadius:14,marginBottom:8,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
                <div>
                  <p style={{margin:"0 0 2px",fontSize:16,fontWeight:700,color:"#fff"}}>{s.day || s.date} · {s.time}</p>
                  <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.4)"}}>📍 {s.cinema}</p>
                </div>
                <span style={{fontSize:20,color:"rgba(255,255,255,0.25)"}}>›</span>
              </button>
            ))}
            <button onClick={onRejectAll} style={{width:"100%",marginTop:4,padding:13,borderRadius:13,background:"transparent",border:"1px solid rgba(255,69,58,0.2)",color:"rgba(255,69,58,0.55)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Ninguna me viene bien
            </button>
          </>
        )}

        {/* CONFIRMED */}
        {myState === "confirmed" && chosen && !showRoulette && (() => {
          const countdown = formatCountdown(chosen)
          return (
            <div style={{background:"rgba(255,59,59,0.07)",border:"1px solid rgba(255,59,59,0.2)",borderRadius:16,padding:18,textAlign:"center"}}>
              <p style={{fontSize:11,fontWeight:600,color:"#ff3b3b",letterSpacing:"0.08em",textTransform:"uppercase",margin:"0 0 10px"}}>Plan confirmado ✓</p>
              <p style={{fontSize:26,fontWeight:800,color:"#fff",margin:"0 0 4px"}}>{chosen.day || chosen.date} · {chosen.time}</p>
              <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"0 0 4px"}}>📍 {chosen.cinema}</p>
              {countdown && (
                <p style={{fontSize:13,fontWeight:700,color:"#ff3b3b",margin:"0 0 16px"}}>⏱ Quedan {countdown}</p>
              )}
              {!countdown && <div style={{height:12}} />}
              {plan.payer_name && (
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:14}}>
                  <span style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.6)"}}>🎰 Compra las entradas: <strong style={{color:"#ff3b3b"}}>{plan.payer_name}</strong></span>
                  <button onClick={() => setShowRoulette(true)} style={{padding:"4px 10px",borderRadius:8,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.35)",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cambiar</button>
                </div>
              )}
              <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                <button onClick={() => addToCalendar(plan.movie_title, chosen, [plan.partner?.email, user?.email].filter(Boolean))} style={{padding:"13px 24px",borderRadius:100,background:"#ff3b3b",border:"none",color:"#000",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#000" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="#000" strokeWidth="2" strokeLinecap="round"/></svg>
                  Añadir al calendario
                </button>
                {!plan.payer_name && (
                  <button onClick={() => setShowRoulette(true)} style={{padding:"13px 24px",borderRadius:100,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.6)",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                    🎰 ¿Quien compra las entradas?
                  </button>
                )}
              </div>
            </div>
          )
        })()}

        {/* ROULETTE */}
        {myState === "confirmed" && showRoulette && (() => {
          const participants = []
          // Add current user
          if (user) {
            participants.push({ name: user?.user_metadata?.full_name || 'Tú', avatar_url: user?.user_metadata?.avatar_url })
          }
          // Add plan partner
          const partner = plan.partner
          if (partner) {
            participants.push({ name: partner.nombre_display || partner.nombre || partnerName, avatar_url: partner.avatar_url })
          } else {
            participants.push({ name: partnerName, avatar_url: null })
          }
          return <RouletteWheel participants={participants} onDone={(winnerName) => {
            if (onSavePayer) onSavePayer(winnerName)
            setShowRoulette(false)
          }} />
        })()}

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

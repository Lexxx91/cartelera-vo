import { useState } from 'react'
import SwipeCard from './SwipeCard.jsx'
import BrickBreaker from './BrickBreaker.jsx'

export default function CartelleraTab({ movies, loading, error, myVotes, friendVotes, onSwipe, user, campaignOverrides }) {
  const [swiped, setSwiped] = useState({})
  const [history, setHistory] = useState([])
  const [showGame, setShowGame] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Filter: only movies I haven't voted on (unless showAll after reset)
  const remaining = movies.filter(m => !swiped[m.title] && (showAll || !myVotes[m.title]))

  function handleSwipe(direction) {
    if (remaining.length === 0) return
    const movie = remaining[0]
    setSwiped(prev => ({ ...prev, [movie.title]: direction }))
    setHistory(prev => [...prev, movie.title])
    onSwipe(movie, direction)
  }

  function handleUndo() {
    if (history.length === 0) return
    const last = history[history.length - 1]
    setSwiped(prev => {
      const next = { ...prev }
      delete next[last]
      return next
    })
    setHistory(prev => prev.slice(0, -1))
  }

  function resetAll() {
    setSwiped({})
    setHistory([])
    setShowGame(false)
    setShowAll(true)
  }

  const stackCards = remaining.slice(0, 4)
  const total = movies.length

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 56px)",overflow:"hidden"}}>
      {/* Header — VOSE logo */}
      <div style={{
        flex: remaining.length > 0 ? 1 : "0 0 auto",
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        gap:8,minHeight:0,
        padding: remaining.length > 0 ? 0 : "20px 0 0",
      }}>
        <h1 style={{margin:0,fontSize: remaining.length > 0 ? 56 : 36,fontWeight:400,letterSpacing:"0.02em",fontFamily:"'Archivo Black',sans-serif",color:"#fff",textAlign:"center",textTransform:"uppercase",transition:"font-size 0.3s ease"}}>VO<span style={{color:"#ff3b3b"}}>SE</span></h1>
      </div>

      {/* Main content */}
      <div style={{flex: remaining.length > 0 ? "0 0 auto" : 1,overflow:"visible",position:"relative",padding:"0 20px",display:"flex",flexDirection:"column",minHeight:0}}>
        {loading && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,gap:16}}>
            <div style={{width:28,height:28,border:"3px solid rgba(255,255,255,0.1)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite"}} />
            <span style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>Cargando cartelera...</span>
          </div>
        )}

        {error && (
          <div style={{borderRadius:14,background:"rgba(255,69,58,0.08)",border:"1px solid rgba(255,69,58,0.18)",padding:"14px 16px",marginBottom:12}}>
            <p style={{margin:"0 0 8px",fontSize:13,fontWeight:600,color:"#ff453a"}}>Error al cargar</p>
            <button onClick={()=>window.location.reload()} style={{background:"rgba(255,69,58,0.12)",border:"1px solid rgba(255,69,58,0.25)",color:"#ff453a",borderRadius:9,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Reintentar</button>
          </div>
        )}

        {!loading && !error && movies.length === 0 && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,textAlign:"center",gap:12}}>
            <div style={{fontSize:48}}>🎞️</div>
            <p style={{margin:0,fontSize:15,fontWeight:600,color:"rgba(255,255,255,0.5)"}}>Sin peliculas VO disponibles</p>
            <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.3)"}}>Vuelve mas tarde</p>
          </div>
        )}

        {!loading && !error && remaining.length === 0 && movies.length > 0 && !showGame && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,textAlign:"center",gap:0,padding:"0 24px",animation:"fadeIn 0.6s ease"}}>
            {/* Headline — Canarian vibes */}
            <h2 style={{margin:"0 0 16px",fontFamily:"'Archivo Black',sans-serif",fontSize:44,lineHeight:0.95,letterSpacing:"-0.02em",textTransform:"uppercase"}}>
              <span style={{WebkitTextStroke:"2px #fff",color:"transparent",display:"block",animation:"fadeIn 0.5s ease both 0.1s"}}>TRANQUI,</span>
              <span style={{color:"#ff3b3b",display:"block",animation:"fadeIn 0.5s ease both 0.3s"}}>CHACHO</span>
            </h2>

            {/* Body */}
            <p style={{margin:"0 0 28px",fontSize:13,color:"rgba(255,255,255,0.45)",lineHeight:1.6,maxWidth:280,animation:"fadeIn 0.5s ease both 0.5s"}}>
              Deslizaste las {total} pelis en VO. Cuando llegue una nueva en los proximos 14 dias, te la enseñamos al momento.
            </p>

            {/* CTA: Ver todas */}
            <button onClick={resetAll} style={{
              width:"100%",maxWidth:280,padding:"14px 20px",borderRadius:12,
              background:"#ff3b3b",border:"none",
              color:"#000",fontSize:14,fontWeight:800,
              fontFamily:"'Archivo Black',sans-serif",
              cursor:"pointer",textTransform:"uppercase",
              letterSpacing:"0.02em",marginBottom:12,
              animation:"fadeIn 0.5s ease both 0.6s",
            }}>
              Ver todas otra vez
            </button>

            {/* CTA: Jugar */}
            <p style={{margin:"0 0 8px",fontSize:12,color:"rgba(255,255,255,0.25)",animation:"fadeIn 0.5s ease both 0.8s"}}>
              Mientras tanto...
            </p>
            <button onClick={() => setShowGame(true)} style={{
              width:"100%",maxWidth:280,padding:"12px 20px",borderRadius:12,
              background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.1)",
              color:"rgba(255,255,255,0.6)",fontSize:13,fontWeight:600,
              fontFamily:"inherit",cursor:"pointer",
              animation:"fadeIn 0.5s ease both 0.9s",
            }}>
              🎮 Echale una partida
            </button>
          </div>
        )}

        {/* Brick Breaker game */}
        {!loading && !error && remaining.length === 0 && movies.length > 0 && showGame && (
          <div style={{flex:1,display:"flex",flexDirection:"column",padding:"0 4px",minHeight:0,maxHeight:"calc(100vh - 56px - 56px - 20px)",animation:"fadeIn 0.3s ease"}}>
            <BrickBreaker user={user} onClose={() => setShowGame(false)} campaignOverrides={campaignOverrides} />
          </div>
        )}

        {!loading && !error && remaining.length > 0 && (
          <>
            <div style={{position:"relative",height:"min(480px, 65vh)",overflow:"visible"}}>
              {stackCards.map((movie, si) => (
                <SwipeCard
                  key={movie.title}
                  movie={movie}
                  isTop={si === 0}
                  stackIndex={si}
                  onSwipe={handleSwipe}
                  friendVoters={friendVotes[movie.title] || []}
                />
              ))}
            </div>

            {/* Action buttons */}
            <div style={{flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",gap:20,padding:"10px 0 14px"}}>
              <button onClick={()=>handleSwipe('paso')} style={{width:64,height:64,borderRadius:"50%",background:"rgba(255,69,58,0.12)",border:"2px solid rgba(255,69,58,0.4)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:24,transition:"all 0.2s"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#ff453a" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </button>
              <button onClick={handleUndo} disabled={history.length===0} style={{width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",cursor:history.length>0?"pointer":"not-allowed",fontSize:16,opacity:history.length>0?1:0.3,transition:"all 0.2s"}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 14L4 9l5-5M4 9h11a6 6 0 010 12h-1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button onClick={()=>handleSwipe('voy')} style={{width:64,height:64,borderRadius:"50%",background:"rgba(255,59,59,0.12)",border:"2px solid rgba(255,59,59,0.4)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:24,transition:"all 0.2s"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#ff3b3b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

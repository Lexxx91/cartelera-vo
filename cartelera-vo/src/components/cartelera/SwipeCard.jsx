import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'

const SWIPE_THRESHOLD = 100

export default function SwipeCard({ movie, onSwipe, isTop, stackIndex, friendVoters }) {
  const cardRef = useRef(null)
  const dragRef = useRef({ startX: 0, startY: 0, isDragging: false, dragX: 0 })
  const [dragX, setDragX] = useState(0)
  const [isExiting, setIsExiting] = useState(null)
  const [posterLoaded, setPosterLoaded] = useState(false)
  const [showTrailer, setShowTrailer] = useState(false)

  function onPointerDown(e) {
    if (!isTop) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, isDragging: true, dragX: 0 }
    if (cardRef.current) cardRef.current.style.transition = "none"
  }
  function onPointerMove(e) {
    if (!dragRef.current.isDragging) return
    const dx = e.clientX - dragRef.current.startX
    dragRef.current.dragX = dx
    setDragX(dx)
  }
  function onPointerUp() {
    if (!dragRef.current.isDragging) return
    dragRef.current.isDragging = false
    const dx = dragRef.current.dragX
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      const dir = dx > 0 ? 'right' : 'left'
      setIsExiting(dir)
      setTimeout(() => onSwipe(dir === 'right' ? 'voy' : 'paso'), 300)
    } else {
      setDragX(0)
      if (cardRef.current) cardRef.current.style.transition = "transform 0.3s ease"
    }
  }

  const rotation = dragX * 0.08
  const voyOpacity = Math.min(1, Math.max(0, dragX / SWIPE_THRESHOLD))
  const pasoOpacity = Math.min(1, Math.max(0, -dragX / SWIPE_THRESHOLD))

  // ─── Stack transforms: cards peek from TOP ────────────────────────
  let transform = ""
  let transition = "none"
  if (isExiting === 'right') {
    transform = "translateX(600px) rotate(25deg)"; transition = "transform 0.3s ease"
  } else if (isExiting === 'left') {
    transform = "translateX(-600px) rotate(-25deg)"; transition = "transform 0.3s ease"
  } else if (stackIndex === 0) {
    transform = `translateX(${dragX}px) rotate(${rotation}deg)`
  } else if (stackIndex === 1) {
    transform = "scale(0.95) translateY(-32px)"; transition = "transform 0.35s cubic-bezier(.4,0,.2,1)"
  } else if (stackIndex === 2) {
    transform = "scale(0.90) translateY(-58px)"; transition = "transform 0.35s cubic-bezier(.4,0,.2,1)"
  } else {
    transform = "scale(0.85) translateY(-82px)"; transition = "transform 0.35s cubic-bezier(.4,0,.2,1)"
  }

  // Shadow per card for depth
  let boxShadow = "none"
  if (stackIndex === 0) {
    boxShadow = "0 20px 60px rgba(0,0,0,0.7)"
  } else if (stackIndex === 1) {
    boxShadow = "0 8px 30px rgba(0,0,0,0.5)"
  } else {
    boxShadow = "0 4px 20px rgba(0,0,0,0.4)"
  }

  const voters = friendVoters || []
  const trailerUrl = movie.trailerUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent((movie.originalTitle || movie.title) + " official trailer")}`

  // Extract YouTube video ID for embedding
  function getYouTubeId(url) {
    if (!url) return null
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    return match ? match[1] : null
  }
  const videoId = getYouTubeId(trailerUrl)

  return (
    <div
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{
        position: "absolute", inset: 0, borderRadius: 14, overflow: "hidden",
        cursor: isTop ? "grab" : "default", transform, transition,
        userSelect: "none", touchAction: "none", zIndex: 10 - stackIndex,
        boxShadow,
        border: stackIndex > 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
      }}
    >
      {/* Poster */}
      {movie.poster ? (
        <>
          {!posterLoaded && <div style={{position:"absolute",inset:0,background:"#111",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:24,height:24,border:"2px solid rgba(255,255,255,0.1)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite"}} />
          </div>}
          <img src={movie.poster} alt={movie.title} onLoad={()=>setPosterLoaded(true)}
            style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",display:posterLoaded?"block":"none"}} />
        </>
      ) : (
        <div style={{position:"absolute",inset:0,background:"linear-gradient(145deg,#1a1a1a,#111)"}} />
      )}

      {/* Gradient overlay */}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.1) 65%, transparent 100%)"}} />

      {/* VOY stamp */}
      <div style={{position:"absolute",top:40,left:24,opacity:voyOpacity,transition:"opacity 0.1s",pointerEvents:"none",transform:"rotate(-15deg)",border:"4px solid #34c759",borderRadius:8,padding:"6px 14px"}}>
        <span style={{fontSize:28,fontWeight:900,color:"#34c759",letterSpacing:"0.05em"}}>VOY</span>
      </div>
      {/* PASO stamp */}
      <div style={{position:"absolute",top:40,right:24,opacity:pasoOpacity,transition:"opacity 0.1s",pointerEvents:"none",transform:"rotate(15deg)",border:"4px solid #ff453a",borderRadius:8,padding:"6px 14px"}}>
        <span style={{fontSize:28,fontWeight:900,color:"#ff453a",letterSpacing:"0.05em"}}>PASO</span>
      </div>

      {/* Duration & genre pills — top left */}
      {stackIndex === 0 && (
        <div style={{position:"absolute",top:16,left:16,display:"flex",flexDirection:"column",gap:6,pointerEvents:"none"}}>
          {movie.duration && (
            <span style={{
              background:"rgba(0,0,0,0.65)",backdropFilter:"blur(12px)",
              borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:700,
              color:"#fff",display:"flex",alignItems:"center",gap:4,width:"fit-content",
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              {movie.duration >= 60 ? `${Math.floor(movie.duration / 60)}h ${movie.duration % 60}m` : `${movie.duration} min`}
            </span>
          )}
          {movie.genre && movie.genre.trim().length > 1 && (
            <span style={{
              background:"rgba(0,0,0,0.65)",backdropFilter:"blur(12px)",
              borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,
              color:"rgba(255,255,255,0.85)",width:"fit-content",
            }}>
              {movie.genre}
            </span>
          )}
        </div>
      )}

      {/* Friend avatars (social indicator) */}
      {voters.length > 0 && stackIndex === 0 && (
        <div style={{position:"absolute",top:16,right:16,display:"flex",alignItems:"center",gap:0}}>
          {voters.slice(0, 3).map((v, i) => (
            <div key={v.userId} style={{
              width:28, height:28, borderRadius:"50%",
              border:"2px solid rgba(0,0,0,0.5)",
              overflow:"hidden", marginLeft:i>0?-8:0, zIndex:4-i,
              background:`hsl(${i*80+200},50%,40%)`,
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>
              {v.avatar_url ? (
                <img src={v.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
              ) : (
                <span style={{fontSize:11,fontWeight:700,color:"#fff"}}>{(v.name||"?").charAt(0)}</span>
              )}
            </div>
          ))}
          {voters.length > 3 && (
            <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(0,0,0,0.7)",border:"2px solid rgba(0,0,0,0.5)",marginLeft:-8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff"}}>
              +{voters.length - 3}
            </div>
          )}
          <div style={{marginLeft:8,background:"rgba(0,0,0,0.6)",borderRadius:8,padding:"4px 8px"}}>
            <span style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.8)"}}>
              {voters.length === 1
                ? `${voters[0].name.split(" ")[0]} quiere verla`
                : `${voters[0].name.split(" ")[0]} y ${voters.length - 1} mas`}
            </span>
          </div>
        </div>
      )}

      {/* Bottom info */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"0 20px 24px",pointerEvents:"none"}}>
        {/* Title */}
        <h2 style={{margin:"0 0 8px",fontSize:26,fontWeight:900,color:"#fff",letterSpacing:"0.06em",lineHeight:1.1,fontFamily:"'Moniqa','DM Sans',sans-serif",textShadow:"0 2px 8px rgba(0,0,0,0.5)"}}>
          {movie.title}
        </h2>

        {/* Synopsis (TMDB) */}
        {movie.synopsis && (
          <p style={{margin:"0 0 10px",fontSize:13,color:"rgba(255,255,255,0.65)",lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",textShadow:"0 1px 4px rgba(0,0,0,0.8)"}}>
            {movie.synopsis}
          </p>
        )}

        {/* Meta row: double rating */}
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12}}>
          {movie.rating && (
            <span style={{fontSize:12,fontWeight:700,color:"#ffd60a",display:"flex",alignItems:"center",gap:3}}>
              <span style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:400,textTransform:"uppercase",letterSpacing:"0.04em"}}>SC</span>
              ★ {movie.rating}
            </span>
          )}
          {movie.tmdbRating && (
            <span style={{fontSize:12,fontWeight:700,color:"#4fc3f7",display:"flex",alignItems:"center",gap:3}}>
              <span style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:400,textTransform:"uppercase",letterSpacing:"0.04em"}}>TMDB</span>
              ★ {movie.tmdbRating}
            </span>
          )}
        </div>

        {/* Trailer button */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation()
            if (videoId) {
              setShowTrailer(true)
            } else {
              window.open(trailerUrl, '_blank')
            }
          }}
          style={{pointerEvents:"auto",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 16px",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:7,backdropFilter:"blur(8px)"}}>
          <span style={{fontSize:15}}>▶</span> Trailer VOSE
        </button>
      </div>

      {/* ── In-app Trailer Overlay (portaled to body) ── */}
      {showTrailer && videoId && createPortal(
        <>
          <style>{`@keyframes trailerFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
          <div
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setShowTrailer(false) }}
            style={{
              position:"fixed",inset:0,zIndex:9999,
              background:"rgba(0,0,0,0.94)",
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              padding:"20px",
              animation:"trailerFadeIn 0.25s ease",
            }}
          >
            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowTrailer(false) }}
              style={{
                position:"absolute",top:16,right:16,zIndex:10,
                width:40,height:40,borderRadius:"50%",
                background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.08)",
                color:"#fff",fontSize:20,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",
              }}
            >
              ✕
            </button>

            {/* Movie title */}
            <p style={{
              margin:"0 0 16px",fontSize:14,fontWeight:600,
              color:"rgba(255,255,255,0.5)",letterSpacing:"0.02em",
              fontFamily:"'DM Sans',sans-serif",
            }}>
              {movie.title}
            </p>

            {/* YouTube embed */}
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width:"100%",maxWidth:640,aspectRatio:"16/9",
                borderRadius:14,overflow:"hidden",
                background:"#000",
                boxShadow:"0 20px 60px rgba(0,0,0,0.8)",
              }}
            >
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
                title={`Trailer - ${movie.title}`}
                style={{width:"100%",height:"100%",border:"none"}}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

import { useState, useRef } from 'react'
import { useVoseAI } from '../../hooks/useVoseAI.js'
import { ShareButton } from './ShareableRenderer.jsx'

const RATING_EMOJI = [
  { min: 1, max: 2, emoji: "😴", label: "SUEÑO" },
  { min: 3, max: 4, emoji: "😐", label: "MEH" },
  { min: 5, max: 6, emoji: "😊", label: "BIEN" },
  { min: 7, max: 8, emoji: "🔥", label: "ÑIOS" },
  { min: 9, max: 10, emoji: "😍", label: "DE LOCOS" },
]

function getRatingEmoji(rating) {
  if (rating == null) return { emoji: "🤷", label: "Sin nota" }
  const match = RATING_EMOJI.find(r => rating >= r.min && rating <= r.max)
  return match || { emoji: "🤷", label: "—" }
}

const DEMO_MEMORY = {
  headline: "LUCÍA, ¿ESTÁS BIEN?",
  subline: "Fuiste al mismo cine que los demás, ¿no? Porque parece que viste otra peli, baifo.",
  vibe: "uno_sufrio",
}

/**
 * MemoryCard — Post-cine memory card with participant ratings + AI commentary.
 */
export default function MemoryCard({ plan, friends, user, posterUrl, isDemoMode, onDismiss }) {
  const { generate, loading, loadingPhrase } = useVoseAI()
  const [memory, setMemory] = useState(plan?.memory_card || null)
  const [showShareable, setShowShareable] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const ratings = plan?.ratings || {}
  const participants = (plan?.participants || []).map(pid => {
    const f = friends.find(fr => fr.id === pid)
    const isMe = pid === user?.id
    const name = isMe ? "Tú" : (f?.nombre_display || f?.nombre || "Amigo").split(" ")[0]
    const rating = ratings[pid]?.rating
    const { emoji, label } = getRatingEmoji(rating)
    return { pid, name, rating, emoji, label, isMe }
  })

  // Need 2+ ratings + 48h since plan
  const ratedCount = participants.filter(p => p.rating != null).length
  if (ratedCount < 2) return null

  async function handleGenerate() {
    if (isDemoMode) {
      setMemory(DEMO_MEMORY)
      return
    }
    const userData = {
      movie_title: plan.movie_title,
      participants: participants.map(p => ({
        name: p.name,
        rating: p.rating,
        is_payer: plan.payer_name && p.name === plan.payer_name,
      })),
      payer: plan.payer_name || null,
    }
    const result = await generate('memory', userData)
    if (result) setMemory(result)
  }

  // Auto-generate if no memory yet
  if (!memory && !loading) {
    handleGenerate()
    return null
  }

  if (loading) {
    return (
      <div style={{margin:"0 20px 16px",borderRadius:20,padding:"24px",background:"linear-gradient(135deg, rgba(201,168,76,0.06) 0%, rgba(0,0,0,0.4) 100%)",border:"1px solid rgba(201,168,76,0.15)",textAlign:"center"}}>
        <div style={{width:28,height:28,margin:"0 auto 12px",border:"2px solid rgba(201,168,76,0.2)",borderTopColor:"#c9a84c",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
        <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.35)",fontStyle:"italic"}}>"{loadingPhrase}"</p>
      </div>
    )
  }

  if (!memory) return null

  const vibeColors = {
    unanime: "rgba(52,199,89,0.15)",
    casi_casi: "rgba(201,168,76,0.12)",
    guerra_civil: "rgba(255,59,59,0.12)",
    uno_sufrio: "rgba(255,59,59,0.08)",
  }

  return (
    <div style={{margin:"0 20px 16px"}}>
      <div style={{
        borderRadius:20,overflow:"hidden",
        background: `linear-gradient(135deg, ${vibeColors[memory.vibe] || "rgba(255,255,255,0.04)"} 0%, rgba(0,0,0,0.4) 100%)`,
        border:"1px solid rgba(255,255,255,0.1)",
      }}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 18px 12px"}}>
          {posterUrl && (
            <div style={{width:44,height:66,borderRadius:8,overflow:"hidden",flexShrink:0,background:"#111"}}>
              <img src={posterUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
            </div>
          )}
          <div style={{flex:1,minWidth:0}}>
            <p style={{margin:"0 0 2px",fontSize:10,fontWeight:700,color:"#c9a84c",textTransform:"uppercase",letterSpacing:"0.06em"}}>Recuerdo</p>
            <p style={{margin:"0 0 4px",fontSize:15,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {plan.movie_title}
            </p>
            <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.3)"}}>
              {plan.chosen_session?.day || plan.chosen_session?.date}
              {plan.chosen_session?.cinema && ` · ${plan.chosen_session.cinema}`}
            </p>
          </div>
          <button onClick={() => { setDismissed(true); onDismiss?.() }} style={{background:"none",border:"none",color:"rgba(255,255,255,0.2)",fontSize:16,cursor:"pointer",padding:4,fontFamily:"inherit"}}>✕</button>
        </div>

        {/* Participant ratings */}
        <div style={{display:"flex",justifyContent:"center",gap:12,padding:"8px 18px 16px"}}>
          {participants.map(p => (
            <div key={p.pid} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <span style={{fontSize:28}}>{p.emoji}</span>
              <span style={{fontSize:14,fontWeight:700,color: p.rating != null ? "#fff" : "rgba(255,255,255,0.3)"}}>{p.rating ?? "—"}</span>
              <span style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.35)",maxWidth:50,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
            </div>
          ))}
        </div>

        {/* AI headline + subline */}
        <div style={{padding:"0 18px 16px",textAlign:"center"}}>
          <p style={{margin:"0 0 6px",fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:16,color:"#fff",textTransform:"uppercase",lineHeight:1.3}}>
            {memory.headline}
          </p>
          <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>
            {memory.subline}
          </p>
        </div>

        {/* Payer */}
        {plan.payer_name && (
          <div style={{padding:"0 18px 12px",textAlign:"center"}}>
            <span style={{fontSize:11,color:"rgba(201,168,76,0.5)"}}>🎰 Pagó: {plan.payer_name}</span>
          </div>
        )}

        {/* Share */}
        <div style={{padding:"0 18px 18px"}}>
          <ShareButton onClick={() => setShowShareable(true)} label="Compartir recuerdo" />
        </div>
      </div>

      {/* Shareable overlay — IG Stories safe zones: 13% top, 18% bottom */}
      {showShareable && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"#000",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"13% 20px 18%"}} onClick={() => setShowShareable(false)}>
          <div style={{width:360,background:"#000",borderRadius:16,padding:"40px 28px",border:"1px solid rgba(255,255,255,0.1)"}} onClick={e => e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"baseline",gap:0,marginBottom:20}}>
              <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:14,color:"#fff"}}>VO</span>
              <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:14,color:"#ff3b3b"}}>SE</span>
            </div>
            <h3 style={{margin:"0 0 8px",fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:20,color:"#fff",textAlign:"center",lineHeight:1.2}}>{plan.movie_title}</h3>
            <p style={{margin:"0 0 20px",fontSize:11,color:"rgba(255,255,255,0.3)",textAlign:"center"}}>
              {plan.chosen_session?.day || plan.chosen_session?.date}
            </p>
            <div style={{display:"flex",justifyContent:"center",gap:16,marginBottom:20}}>
              {participants.map(p => (
                <div key={p.pid} style={{textAlign:"center"}}>
                  <p style={{fontSize:28,margin:"0 0 2px"}}>{p.emoji}</p>
                  <p style={{margin:"0 0 2px",fontSize:14,fontWeight:700,color:"#fff"}}>{p.rating ?? "—"}</p>
                  <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.4)"}}>{p.name}</p>
                </div>
              ))}
            </div>
            <p style={{margin:"0 0 8px",fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:16,color:"#fff",textAlign:"center",textTransform:"uppercase"}}>{memory.headline}</p>
            <p style={{margin:"0 0 20px",fontSize:12,color:"rgba(255,255,255,0.5)",textAlign:"center",lineHeight:1.5}}>{memory.subline}</p>
            <div style={{paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.06)",textAlign:"center"}}>
              <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.2)"}}>carteleravo.app</p>
            </div>
          </div>
          <button onClick={() => setShowShareable(false)} style={{marginTop:16,padding:"10px 24px",borderRadius:12,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cerrar</button>
        </div>
      )}
    </div>
  )
}

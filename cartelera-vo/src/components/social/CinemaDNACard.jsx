import { useState, useRef } from 'react'
import { useVoseAI, LOADING_PHRASES } from '../../hooks/useVoseAI.js'
import { ShareButton } from './ShareableRenderer.jsx'

const DEMO_DNA = {
  archetype_name: "EL BAIFO CINÉFILO",
  archetype_emoji: "🐐🍿",
  one_liner: "Vas al cine como quien va a misa: con fe ciega",
  roast: "3 pelis vistas y ya te crees Scorsese canario. Le das voy a todo lo que tenga subtítulos como si eso te hiciera mejor persona, chacho.",
  secret_taste: "En el fondo quieres ver un romcom pero tu ego de cinéfilo no te deja, baifo.",
  squad_verdict: "Carlos y tú ya sois pareja de cine, aceptadlo.",
  genre_bars: [
    { genre: "Drama", pct: 72, emoji: "🎭" },
    { genre: "Thriller", pct: 55, emoji: "🔪" },
    { genre: "Sci-Fi", pct: 33, emoji: "🚀" },
    { genre: "Comedia", pct: 12, emoji: "😂" },
    { genre: "Terror", pct: 0, emoji: "👻" },
  ],
}

function AILoadingState({ phrase }) {
  return (
    <div style={{padding:"24px 20px"}}>
      <style>{`
        @keyframes dnaShimmer {
          0% { background-position: -200px 0; }
          100% { background-position: 200px 0; }
        }
        @keyframes phraseSwap {
          0%, 90% { opacity: 1; transform: translateY(0); }
          95% { opacity: 0; transform: translateY(-6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Shimmer skeleton bars */}
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
        {[60, 80, 45, 70, 30].map((w, i) => (
          <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:50,height:8,borderRadius:4,background:"linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,59,59,0.1) 50%, rgba(255,255,255,0.04) 75%)",backgroundSize:"400px 100%",animation:`dnaShimmer 1.5s ease infinite ${i*0.15}s`}} />
            <div style={{flex:1,height:8,borderRadius:4,overflow:"hidden",background:"rgba(255,255,255,0.04)"}}>
              <div style={{width:`${w}%`,height:"100%",borderRadius:4,background:"linear-gradient(90deg, rgba(255,59,59,0.15) 25%, rgba(255,59,59,0.35) 50%, rgba(255,59,59,0.15) 75%)",backgroundSize:"400px 100%",animation:`dnaShimmer 1.5s ease infinite ${i*0.15}s`}} />
            </div>
          </div>
        ))}
      </div>
      {/* Rotating copy */}
      <div style={{textAlign:"center"}}>
        <div style={{width:28,height:28,margin:"0 auto 12px",border:"2px solid rgba(255,59,59,0.15)",borderTopColor:"#ff3b3b",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
        <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.35)",lineHeight:1.5,fontStyle:"italic",minHeight:36,animation:"phraseSwap 2s ease infinite"}}>
          "{phrase}"
        </p>
      </div>
    </div>
  )
}

/**
 * CinemaDNACard — Shows the user's Cinema DNA archetype.
 * Can generate via AI or show cached/demo data.
 */
export default function CinemaDNACard({ profile, user, myVotes, friends, plans, isDemoMode, movies, onUpdateProfile }) {
  const { generate, loading, loadingPhrase } = useVoseAI()
  const [dna, setDna] = useState(profile?.cinema_dna || null)
  const [showShareable, setShowShareable] = useState(false)
  const cardRef = useRef(null)

  // Determine if user has enough data
  const voyCount = Object.values(myVotes || {}).filter(v => v === 'voy').length
  const watched = profile?.watched || []
  const hasEnoughData = voyCount >= 5 && watched.filter(w => w.rating).length >= 2

  async function handleGenerate() {
    if (isDemoMode) {
      setDna(DEMO_DNA)
      return
    }

    // Build user_data for the AI
    const genreCounts = {}
    for (const [title, vote] of Object.entries(myVotes || {})) {
      if (vote !== 'voy') continue
      const movie = (movies || []).find(m => m.title === title)
      if (movie?.genre) {
        const genres = movie.genre.split(/[,/]/).map(g => g.trim()).filter(Boolean)
        genres.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1 })
      }
    }

    const userData = {
      total_voy: voyCount,
      total_paso: Object.values(myVotes || {}).filter(v => v === 'paso').length,
      watched: watched.map(w => ({ title: w.title, rating: w.rating })),
      genre_counts: genreCounts,
      friends_count: friends?.length || 0,
      plans_count: plans?.length || 0,
      frequent_buddy: getFrequentBuddy(plans, friends, user),
    }

    const result = await generate('dna', userData)
    if (result) {
      setDna(result)
      if (onUpdateProfile) onUpdateProfile({ cinema_dna: result })
    }
  }

  if (!hasEnoughData && !dna) {
    return (
      <div style={{margin:"0 20px 16px",padding:"20px",borderRadius:20,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",textAlign:"center"}}>
        <p style={{fontSize:28,margin:"0 0 8px"}}>🧬</p>
        <p style={{margin:"0 0 4px",fontSize:14,fontWeight:600,color:"rgba(255,255,255,0.5)"}}>ADN de Cine</p>
        <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.25)",lineHeight:1.5}}>
          Haz swipe en {Math.max(0, 5 - voyCount)} pelis más y valora {Math.max(0, 2 - watched.filter(w => w.rating).length)} para desbloquear tu arquetipo.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{margin:"0 20px 16px",borderRadius:20,background:"linear-gradient(135deg, rgba(255,59,59,0.06) 0%, rgba(0,0,0,0.4) 100%)",border:"1px solid rgba(255,59,59,0.15)",overflow:"hidden"}}>
        <AILoadingState phrase={loadingPhrase} />
      </div>
    )
  }

  if (!dna) {
    return (
      <div style={{margin:"0 20px 16px",padding:"24px 20px",borderRadius:20,background:"linear-gradient(135deg, rgba(255,59,59,0.06) 0%, rgba(0,0,0,0.4) 100%)",border:"1px solid rgba(255,59,59,0.15)",textAlign:"center"}}>
        <p style={{fontSize:32,margin:"0 0 10px"}}>🧬</p>
        <p style={{margin:"0 0 6px",fontFamily:"'Archivo Black',sans-serif",fontSize:16,fontWeight:400,color:"#fff"}}>ADN DE CINE</p>
        <p style={{margin:"0 0 16px",fontSize:12,color:"rgba(255,255,255,0.35)",lineHeight:1.5}}>
          Descubre tu arquetipo cinéfilo. VOSE AI analiza tus gustos y te dice quién eres de verdad.
        </p>
        <button onClick={handleGenerate} style={{
          padding:"12px 28px",borderRadius:14,
          background:"#ff3b3b",border:"none",
          color:"#000",fontSize:13,fontWeight:800,fontFamily:"'Archivo Black',sans-serif",
          cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.02em",
        }}>
          Generar mi ADN
        </button>
      </div>
    )
  }

  // DNA display
  return (
    <div style={{margin:"0 20px 16px"}}>
      {/* In-app card */}
      <div style={{
        borderRadius:20,overflow:"hidden",
        background:"linear-gradient(135deg, rgba(255,59,59,0.08) 0%, rgba(0,0,0,0.5) 100%)",
        border:"1px solid rgba(255,59,59,0.2)",
      }}>
        <div style={{padding:"20px 20px 4px",textAlign:"center"}}>
          <p style={{fontSize:36,margin:"0 0 6px"}}>{dna.archetype_emoji}</p>
          <h3 style={{margin:"0 0 8px",fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:20,color:"#fff",lineHeight:1.2,textTransform:"uppercase"}}>
            {dna.archetype_name}
          </h3>
          <p style={{margin:"0 0 16px",fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.5,fontStyle:"italic"}}>
            "{dna.one_liner}"
          </p>
        </div>

        {/* Genre bars */}
        {dna.genre_bars?.length > 0 && (
          <div style={{padding:"0 20px 16px"}}>
            {dna.genre_bars.map((bar, i) => (
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{width:60,fontSize:11,color:"rgba(255,255,255,0.4)",textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bar.genre}</span>
                <div style={{flex:1,height:8,borderRadius:4,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                  <div style={{width:`${bar.pct}%`,height:"100%",borderRadius:4,background:"#ff3b3b",transition:"width 1s ease"}} />
                </div>
                <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.3)",width:32,textAlign:"right"}}>{bar.pct}%</span>
                <span style={{fontSize:14}}>{bar.emoji}</span>
              </div>
            ))}
          </div>
        )}

        {/* Roast */}
        <div style={{padding:"0 20px 16px"}}>
          <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.45)",lineHeight:1.6}}>{dna.roast}</p>
        </div>

        {/* Secret taste */}
        {dna.secret_taste && (
          <div style={{padding:"0 20px 16px"}}>
            <p style={{margin:0,fontSize:12,color:"rgba(255,59,59,0.6)",lineHeight:1.5,fontStyle:"italic"}}>
              {dna.secret_taste}
            </p>
          </div>
        )}

        {/* Squad verdict */}
        {dna.squad_verdict && (
          <div style={{padding:"0 20px 16px"}}>
            <p style={{margin:0,fontSize:11,color:"rgba(201,168,76,0.6)"}}>
              {dna.squad_verdict}
            </p>
          </div>
        )}

        {/* Share button */}
        <div style={{padding:"0 20px 20px"}}>
          <ShareButton onClick={() => setShowShareable(true)} label="Compartir ADN" />
        </div>
      </div>

      {/* Shareable overlay — IG Stories safe zones: 250px top, 350px bottom on 1920h */}
      {showShareable && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"#000",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"13% 20px 18%"}} onClick={() => setShowShareable(false)}>
          <p style={{margin:"0 0 12px",fontSize:13,color:"rgba(255,255,255,0.5)"}}>
            Haz screenshot o pulsa compartir
          </p>
          <div ref={cardRef} style={{
            width:360,maxHeight:"60vh",overflow:"auto",
            background:"#000",borderRadius:16,padding:"40px 28px",
            border:"1px solid rgba(255,59,59,0.2)",
          }} onClick={e => e.stopPropagation()}>
            {/* Mini story preview */}
            <div style={{display:"flex",alignItems:"baseline",gap:0,marginBottom:24}}>
              <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:14,color:"#fff",letterSpacing:"0.02em"}}>VO</span>
              <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:14,color:"#ff3b3b",letterSpacing:"0.02em"}}>SE</span>
            </div>
            <p style={{fontSize:32,margin:"0 0 8px",textAlign:"center"}}>{dna.archetype_emoji}</p>
            <h3 style={{margin:"0 0 12px",fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:22,color:"#fff",textAlign:"center",textTransform:"uppercase",lineHeight:1.2}}>{dna.archetype_name}</h3>
            <p style={{margin:"0 0 20px",fontSize:13,color:"rgba(255,255,255,0.7)",textAlign:"center",fontStyle:"italic",lineHeight:1.4}}>"{dna.one_liner}"</p>

            {dna.genre_bars?.map((bar, i) => (
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{width:55,fontSize:11,color:"rgba(255,255,255,0.4)",textAlign:"right"}}>{bar.genre}</span>
                <div style={{flex:1,height:8,borderRadius:4,background:"rgba(255,255,255,0.08)"}}>
                  <div style={{width:`${bar.pct}%`,height:"100%",borderRadius:4,background:"#ff3b3b"}} />
                </div>
                <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",width:28,textAlign:"right"}}>{bar.pct}%</span>
                <span style={{fontSize:13}}>{bar.emoji}</span>
              </div>
            ))}

            <p style={{margin:"16px 0 0",fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.6,textAlign:"center"}}>{dna.secret_taste}</p>
            <div style={{marginTop:20,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.06)",textAlign:"center"}}>
              <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.2)"}}>carteleravo.app</p>
            </div>
          </div>
          <button onClick={() => setShowShareable(false)} style={{
            marginTop:16,padding:"10px 24px",borderRadius:12,
            background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
            color:"rgba(255,255,255,0.5)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
          }}>Cerrar</button>
        </div>
      )}
    </div>
  )
}

function getFrequentBuddy(plans, friends, user) {
  if (!plans || !friends || !user) return null
  const counts = {}
  for (const p of plans) {
    if (p.state !== 'confirmed') continue
    for (const pid of (p.participants || [])) {
      if (pid !== user.id) counts[pid] = (counts[pid] || 0) + 1
    }
  }
  const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!topId) return null
  const f = friends.find(fr => fr.id === topId)
  return f ? { name: f.nombre_display || f.nombre, count: counts[topId] } : null
}

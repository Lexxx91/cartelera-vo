import { useState, useEffect } from 'react'
import { useVoseAI } from '../../hooks/useVoseAI.js'
import { ShareButton } from './ShareableRenderer.jsx'

const DEMO_RECAP = {
  title: "MARZO: MES DE BUEN CINE Y MALAS DECISIONES",
  highlight: "Le diste un 10 a todo. Eres el amigo que dice que cualquier bar es bueno. Cero criterio, chacho, pero al menos vas al cine.",
  buddy_comment: "Carlos y tú ya podéis pedir un abono para dos, ¿no?",
  hot_take: "Fuiste a ver esa de acción sabiendo lo que era. Eso dice mucho de ti como persona.",
}

function getMonthName(monthNum) {
  return ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][monthNum] || ""
}

/**
 * RecapCard — Monthly VOSE recap shown at top of Planes tab.
 * Checks if recap should be generated (1+ completed plan or 3+ votes last month).
 */
export default function RecapCard({ profile, user, plans, friends, myVotes, isDemoMode, movies, onUpdateProfile }) {
  const { generate, loading, loadingPhrase } = useVoseAI()
  const [recap, setRecap] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const [checked, setChecked] = useState(false)

  const now = new Date()
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = `${lastMonthDate.getFullYear()}-${lastMonthDate.getMonth()}`
  const monthName = getMonthName(lastMonthDate.getMonth())

  useEffect(() => {
    if (checked) return
    setChecked(true)

    // Check if we already have a recap for last month
    if (profile?.last_recap?.month === lastMonth) {
      setRecap(profile.last_recap.data)
      return
    }

    // Check if user had activity last month
    const lastMonthStart = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1)

    const plansLastMonth = (plans || []).filter(p => {
      if (p.state !== 'confirmed' || !p.chosen_session?.date) return false
      const d = new Date(p.chosen_session.date)
      return d >= lastMonthStart && d < lastMonthEnd
    })

    const watchedLastMonth = (profile?.watched || []).filter(w => {
      if (!w.date) return false
      const d = new Date(w.date)
      return d >= lastMonthStart && d < lastMonthEnd
    })

    if (plansLastMonth.length === 0 && watchedLastMonth.length < 1) {
      return // Not enough activity
    }

    // Generate recap
    generateRecap(plansLastMonth, watchedLastMonth)
  }, [profile, plans])

  async function generateRecap(plansLastMonth, watchedLastMonth) {
    if (isDemoMode) {
      setRecap(DEMO_RECAP)
      return
    }

    const buddyCounts = {}
    for (const p of plansLastMonth) {
      for (const pid of (p.participants || [])) {
        if (pid !== user?.id) buddyCounts[pid] = (buddyCounts[pid] || 0) + 1
      }
    }
    const topBuddyId = Object.entries(buddyCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    const topBuddy = topBuddyId ? friends?.find(f => f.id === topBuddyId) : null

    const avgRating = watchedLastMonth.length > 0
      ? (watchedLastMonth.reduce((s, w) => s + (w.rating || 0), 0) / watchedLastMonth.length).toFixed(1)
      : null

    const bestMovie = watchedLastMonth.sort((a, b) => (b.rating || 0) - (a.rating || 0))[0]
    const worstMovie = watchedLastMonth.sort((a, b) => (a.rating || 0) - (b.rating || 0))[0]

    const userData = {
      month: monthName,
      movies_count: watchedLastMonth.length,
      plans_count: plansLastMonth.length,
      avg_rating: avgRating,
      best_movie: bestMovie ? { title: bestMovie.title, rating: bestMovie.rating } : null,
      worst_movie: worstMovie && worstMovie !== bestMovie ? { title: worstMovie.title, rating: worstMovie.rating } : null,
      top_buddy: topBuddy ? { name: topBuddy.nombre_display || topBuddy.nombre, count: buddyCounts[topBuddyId] } : null,
      watched: watchedLastMonth.map(w => ({ title: w.title, rating: w.rating })),
    }

    const result = await generate('recap', userData)
    if (result) {
      setRecap(result)
      if (onUpdateProfile) onUpdateProfile({ last_recap: { month: lastMonth, data: result } })
    }
  }

  if (dismissed || !recap) return null

  // Compute stats for display
  const lastMonthStart = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1)
  const watchedLastMonth = (profile?.watched || []).filter(w => {
    if (!w.date) return false
    const d = new Date(w.date)
    return d >= lastMonthStart && d < lastMonthEnd
  })
  const plansLastMonth = (plans || []).filter(p => {
    if (p.state !== 'confirmed' || !p.chosen_session?.date) return false
    const d = new Date(p.chosen_session.date)
    return d >= lastMonthStart && d < lastMonthEnd
  })
  const avgRating = watchedLastMonth.length > 0
    ? (watchedLastMonth.reduce((s, w) => s + (w.rating || 0), 0) / watchedLastMonth.length).toFixed(1)
    : null
  const bestMovie = [...watchedLastMonth].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0]

  return (
    <div style={{margin:"0 20px 16px"}}>
      <div style={{
        borderRadius:20,overflow:"hidden",
        background:"linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(0,0,0,0.5) 100%)",
        border:"1px solid rgba(201,168,76,0.2)",
      }}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 18px 8px"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{display:"flex",alignItems:"baseline",gap:0}}>
              <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:11,color:"#fff"}}>VO</span>
              <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:11,color:"#ff3b3b"}}>SE</span>
            </div>
            <span style={{fontSize:10,fontWeight:600,color:"rgba(201,168,76,0.6)",textTransform:"uppercase",letterSpacing:"0.06em"}}>· Recap</span>
          </div>
          <button onClick={() => setDismissed(true)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.2)",fontSize:14,cursor:"pointer",padding:4,fontFamily:"inherit"}}>✕</button>
        </div>

        {/* Title from AI */}
        <div style={{padding:"0 18px 16px"}}>
          <h3 style={{margin:0,fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:17,color:"#fff",lineHeight:1.3,textTransform:"uppercase"}}>
            {recap.title}
          </h3>
        </div>

        {/* Stats row */}
        <div style={{display:"flex",gap:16,padding:"0 18px 16px"}}>
          {watchedLastMonth.length > 0 && (
            <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>🎬 {watchedLastMonth.length} pelis</span>
          )}
          {plansLastMonth.length > 0 && (
            <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>🍿 {plansLastMonth.length} planes</span>
          )}
          {avgRating && (
            <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>⭐ {avgRating} media</span>
          )}
        </div>

        {/* Best movie */}
        {bestMovie && (
          <div style={{padding:"0 18px 12px"}}>
            <p style={{margin:"0 0 2px",fontSize:10,fontWeight:600,color:"rgba(201,168,76,0.5)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Peli del mes</p>
            <p style={{margin:0,fontSize:13,color:"#fff",fontWeight:600}}>
              {bestMovie.title} · {bestMovie.rating}/10 😍
            </p>
          </div>
        )}

        {/* AI highlight */}
        <div style={{padding:"0 18px 12px"}}>
          <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.55)",lineHeight:1.6,fontStyle:"italic"}}>
            "{recap.highlight}"
          </p>
        </div>

        {/* Buddy comment */}
        {recap.buddy_comment && (
          <div style={{padding:"0 18px 12px"}}>
            <p style={{margin:0,fontSize:11,color:"rgba(201,168,76,0.5)"}}>
              {recap.buddy_comment}
            </p>
          </div>
        )}

        {/* Hot take */}
        {recap.hot_take && (
          <div style={{padding:"0 18px 16px"}}>
            <p style={{margin:0,fontSize:11,color:"rgba(255,59,59,0.5)"}}>
              🔥 {recap.hot_take}
            </p>
          </div>
        )}

        {/* Share */}
        <div style={{padding:"0 18px 18px"}}>
          <ShareButton onClick={() => {}} label="Compartir recap" />
        </div>
      </div>
    </div>
  )
}

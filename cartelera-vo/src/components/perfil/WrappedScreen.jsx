import { useState, useEffect, useCallback } from 'react'

// ─── Stats computation ──────────────────────────────────────────────────────
function computeWrappedStats(pastPlans, friends, userId, year) {
  const yearPlans = pastPlans.filter(p => p.chosen_session?.date?.startsWith(String(year)))

  if (yearPlans.length === 0) return null

  // Total visits
  const totalVisits = yearPlans.length

  // Movies seen (unique titles)
  const moviesSeen = [...new Set(yearPlans.map(p => p.movie_title))]

  // Top buddy — count co-attendance per friend
  const buddyCount = {}
  yearPlans.forEach(plan => {
    const ids = plan.participants || [plan.initiator_id, plan.partner_id]
    ids.forEach(id => {
      if (!id || id === userId || id === 'demo-local-user') return
      buddyCount[id] = (buddyCount[id] || 0) + 1
    })
  })
  let topBuddy = null
  let topBuddyCount = 0
  Object.entries(buddyCount).forEach(([id, count]) => {
    if (count > topBuddyCount) {
      topBuddyCount = count
      const friend = (friends || []).find(f => f.id === id)
      topBuddy = {
        id,
        name: friend?.nombre_display || friend?.nombre || 'Amigo',
        count,
      }
    }
  })

  // Favorite cinema
  const cinemaCount = {}
  yearPlans.forEach(plan => {
    const cinema = plan.chosen_session?.cinema
    if (cinema) cinemaCount[cinema] = (cinemaCount[cinema] || 0) + 1
  })
  let favoriteCinema = null
  let favCinemaCount = 0
  Object.entries(cinemaCount).forEach(([name, count]) => {
    if (count > favCinemaCount) {
      favCinemaCount = count
      favoriteCinema = { name, count }
    }
  })

  // Unique friends
  const uniqueFriendIds = new Set()
  yearPlans.forEach(plan => {
    const ids = plan.participants || [plan.initiator_id, plan.partner_id]
    ids.forEach(id => {
      if (id && id !== userId && id !== 'demo-local-user') uniqueFriendIds.add(id)
    })
  })

  // Most active month
  const monthCount = {}
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  yearPlans.forEach(plan => {
    const m = parseInt(plan.chosen_session?.date?.split('-')[1])
    if (m) monthCount[m] = (monthCount[m] || 0) + 1
  })
  let mostActiveMonth = null
  let mostActiveCount = 0
  Object.entries(monthCount).forEach(([m, count]) => {
    if (count > mostActiveCount) {
      mostActiveCount = count
      mostActiveMonth = { name: monthNames[parseInt(m) - 1], count, month: parseInt(m) }
    }
  })

  // Monthly data for bar chart (all 12 months)
  const monthlyData = monthNames.map((name, i) => ({
    name: name.slice(0, 3),
    count: monthCount[i + 1] || 0,
  }))

  return {
    totalVisits,
    moviesSeen,
    topBuddy,
    favoriteCinema,
    uniqueFriends: uniqueFriendIds.size,
    mostActiveMonth,
    monthlyData,
  }
}

// ─── Share image generation ─────────────────────────────────────────────────
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// ─── WrappedScreen component ────────────────────────────────────────────────
export default function WrappedScreen({ pastPlans, friends, user, movies, year, onClose }) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [sharing, setSharing] = useState(false)
  const userId = user?.id || 'demo-local-user'
  const stats = computeWrappedStats(pastPlans, friends, userId, year)

  // Total number of slides
  const totalSlides = 6

  function nextSlide() {
    if (currentSlide < totalSlides - 1) setCurrentSlide(s => s + 1)
  }
  function prevSlide() {
    if (currentSlide > 0) setCurrentSlide(s => s - 1)
  }

  // Handle tap navigation (left 30% = back, right 70% = forward)
  function handleTap(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = x / rect.width
    if (pct < 0.3) prevSlide()
    else nextSlide()
  }

  // Generate shareable canvas image
  const generateShareImage = useCallback(async () => {
    if (!stats) return null
    const W = 390 * 2
    const H = 680 * 2
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    const s = 2

    try { await document.fonts.ready } catch(e) {}

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#0a0a0a')
    grad.addColorStop(0.3, '#1a0505')
    grad.addColorStop(1, '#0a0a0a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Decorative circles
    ctx.beginPath()
    ctx.arc(W - 40 * s, 80 * s, 100 * s, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,59,59,0.08)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(30 * s, H - 100 * s, 80 * s, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,59,59,0.05)'
    ctx.fill()

    // VOSE logo
    ctx.textAlign = 'center'
    ctx.font = `400 ${26 * s}px 'Archivo Black', sans-serif`
    ctx.fillStyle = '#fff'
    ctx.fillText('VO', W / 2 - 28 * s, 50 * s)
    ctx.fillStyle = '#ff3b3b'
    ctx.fillText('SE', W / 2 + 28 * s, 50 * s)

    // Year
    ctx.fillStyle = '#ff3b3b'
    ctx.font = `400 ${48 * s}px 'Archivo Black', sans-serif`
    ctx.fillText(String(year), W / 2, 100 * s)

    // Subtitle
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `500 ${13 * s}px 'DM Sans', sans-serif`
    ctx.fillText('TU AÑO EN VOSE', W / 2, 122 * s)

    // Stats cards
    let y = 155 * s
    const cardW = 300 * s
    const cardH = 60 * s
    const cardX = (W - cardW) / 2
    const cardR = 16 * s

    const statItems = [
      { emoji: '🎬', label: 'Veces al cine', value: String(stats.totalVisits) },
      { emoji: '🏆', label: 'Top buddy', value: stats.topBuddy?.name || '-' },
      { emoji: '📍', label: 'Cine favorito', value: stats.favoriteCinema?.name || '-' },
      { emoji: '👥', label: 'Amigos distintos', value: String(stats.uniqueFriends) },
      { emoji: '📅', label: 'Mes más activo', value: stats.mostActiveMonth?.name || '-' },
    ]

    for (const item of statItems) {
      // Card background
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      ctx.beginPath()
      ctx.roundRect(cardX, y, cardW, cardH, cardR)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Emoji
      ctx.font = `${20 * s}px sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(item.emoji, cardX + 16 * s, y + 38 * s)

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = `500 ${12 * s}px 'DM Sans', sans-serif`
      ctx.fillText(item.label, cardX + 48 * s, y + 26 * s)

      // Value
      ctx.fillStyle = '#fff'
      ctx.font = `700 ${16 * s}px 'DM Sans', sans-serif`
      ctx.fillText(item.value, cardX + 48 * s, y + 46 * s)

      y += (cardH + 10 * s)
    }

    // Movies list
    y += 10 * s
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = `400 ${10 * s}px 'Archivo Black', sans-serif`
    ctx.fillText('PELÍCULAS VISTAS', W / 2, y)
    y += 18 * s
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = `500 ${11 * s}px 'DM Sans', sans-serif`
    const maxMovies = Math.min(stats.moviesSeen.length, 5)
    for (let i = 0; i < maxMovies; i++) {
      ctx.fillText(stats.moviesSeen[i], W / 2, y)
      y += 16 * s
    }
    if (stats.moviesSeen.length > 5) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.fillText(`+${stats.moviesSeen.length - 5} más`, W / 2, y)
    }

    // Footer
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.font = `500 ${10 * s}px 'DM Sans', sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('cartelera-vo.vercel.app', W / 2, H - 30 * s)

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  }, [stats, year])

  // Share handler
  async function handleShare() {
    setSharing(true)
    try {
      const blob = await generateShareImage()
      if (!blob) return
      const file = new File([blob], `vose-wrapped-${year}.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Mi VOSE Wrapped ${year}` })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `vose-wrapped-${year}.png`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('Share failed:', e)
    } finally {
      setSharing(false)
    }
  }

  if (!stats) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 300, background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
        maxWidth: 430, margin: '0 auto',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 18, left: 18, background: 'none', border: 'none',
          cursor: 'pointer', padding: 6, color: '#fff', zIndex: 10,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
        <p style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 18, color: '#fff', margin: '0 0 8px' }}>
          Sin datos todavía
        </p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '0 40px' }}>
          Necesitas al menos un plan completado en {year} para generar tu Wrapped.
        </p>
      </div>
    )
  }

  // ─── Slide definitions ──────────────────────────────────────────────────────
  const slides = [
    // 0: Intro
    () => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 40 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 32, color: '#fff' }}>VO</span>
          <span style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 32, color: '#ff3b3b' }}>SE</span>
        </div>
        <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 72, color: '#ff3b3b', lineHeight: 1 }}>
          {year}
        </div>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', textAlign: 'center', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Archivo Black',sans-serif", fontWeight: 400 }}>
          Tu año en VOSE
        </p>
      </div>
    ),

    // 1: Total visits
    () => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🎬</div>
        <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 80, color: '#ff3b3b', lineHeight: 1 }}>
          {stats.totalVisits}
        </div>
        <p style={{ fontSize: 18, color: '#fff', textAlign: 'center', margin: '8px 0 0', fontWeight: 600 }}>
          {stats.totalVisits === 1 ? 'vez al cine con amigos' : 'veces al cine con amigos'}
        </p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: '4px 0 0' }}>
          Sin audios. Sin dramas. Solo cine.
        </p>
      </div>
    ),

    // 2: Top buddy
    () => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, padding: 40 }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, #ff3b3b, #cc2020)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 36, fontWeight: 700, color: '#fff' }}>
            {stats.topBuddy?.name?.charAt(0)?.toUpperCase() || '?'}
          </span>
        </div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Archivo Black',sans-serif", fontWeight: 400 }}>
          Tu partner de cine nº1
        </p>
        <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 36, color: '#fff', lineHeight: 1, textAlign: 'center' }}>
          {stats.topBuddy?.name || 'Nadie'}
        </div>
        <p style={{ fontSize: 16, color: '#ff3b3b', margin: '8px 0 0', fontWeight: 700 }}>
          {stats.topBuddy?.count || 0} {(stats.topBuddy?.count || 0) === 1 ? 'vez' : 'veces'} juntos
        </p>
      </div>
    ),

    // 3: Favorite cinema
    () => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>📍</div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Archivo Black',sans-serif", fontWeight: 400 }}>
          Tu cine favorito
        </p>
        <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 28, color: '#fff', lineHeight: 1.2, textAlign: 'center' }}>
          {stats.favoriteCinema?.name || 'Sin datos'}
        </div>
        {stats.favoriteCinema && (
          <p style={{ fontSize: 16, color: '#ff3b3b', margin: '8px 0 0', fontWeight: 700 }}>
            {stats.favoriteCinema.count} {stats.favoriteCinema.count === 1 ? 'visita' : 'visitas'}
          </p>
        )}
        {stats.uniqueFriends > 0 && (
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: '16px 0 0', textAlign: 'center' }}>
            Fuiste con {stats.uniqueFriends} {stats.uniqueFriends === 1 ? 'amigo diferente' : 'amigos diferentes'}
          </p>
        )}
      </div>
    ),

    // 4: Most active month + bar chart
    () => {
      const maxMonthCount = Math.max(...stats.monthlyData.map(d => d.count), 1)
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, padding: '40px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📅</div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Archivo Black',sans-serif", fontWeight: 400 }}>
            Tu mes más activo
          </p>
          <div style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 36, color: '#ff3b3b', lineHeight: 1 }}>
            {stats.mostActiveMonth?.name || '-'}
          </div>

          {/* Monthly bar chart */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 4,
            width: '100%', height: 100, marginTop: 24,
            padding: '0 8px',
          }}>
            {stats.monthlyData.map((d, i) => (
              <div key={i} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <div style={{
                  width: '100%', maxWidth: 24,
                  height: d.count > 0 ? Math.max((d.count / maxMonthCount) * 70, 6) : 3,
                  borderRadius: 4,
                  background: d.count > 0
                    ? (stats.mostActiveMonth && d.name === stats.mostActiveMonth.name.slice(0, 3) ? '#ff3b3b' : 'rgba(255,59,59,0.3)')
                    : 'rgba(255,255,255,0.06)',
                  transition: 'height 0.3s ease',
                }} />
                <span style={{
                  fontSize: 8, color: 'rgba(255,255,255,0.3)',
                  fontWeight: d.count > 0 ? 600 : 400,
                }}>
                  {d.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    },

    // 5: Summary + share
    () => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: '40px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 8 }}>
          <span style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 22, color: '#fff' }}>VO</span>
          <span style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 22, color: '#ff3b3b' }}>SE</span>
          <span style={{ fontFamily: "'Archivo Black',sans-serif", fontSize: 22, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>{year}</span>
        </div>

        {/* Summary card */}
        <div style={{
          width: '100%', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20,
          padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {[
            { emoji: '🎬', label: 'Veces al cine', value: stats.totalVisits },
            { emoji: '🏆', label: 'Top buddy', value: stats.topBuddy?.name || '-' },
            { emoji: '📍', label: 'Cine favorito', value: stats.favoriteCinema?.name || '-' },
            { emoji: '👥', label: 'Amigos', value: stats.uniqueFriends },
            { emoji: '📅', label: 'Mes top', value: stats.mostActiveMonth?.name || '-' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>{item.emoji}</span>
              <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{item.label}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Movies list */}
        <div style={{ width: '100%' }}>
          <p style={{
            margin: '0 0 8px', fontSize: 10, fontFamily: "'Archivo Black',sans-serif",
            color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em',
            textAlign: 'center',
          }}>
            Películas vistas
          </p>
          <div style={{ textAlign: 'center' }}>
            {stats.moviesSeen.slice(0, 6).map((title, i) => (
              <span key={i} style={{
                display: 'inline-block', margin: '0 4px 6px',
                padding: '4px 10px', borderRadius: 8,
                background: 'rgba(255,59,59,0.1)', border: '1px solid rgba(255,59,59,0.15)',
                fontSize: 11, color: 'rgba(255,255,255,0.7)',
              }}>
                {title}
              </span>
            ))}
            {stats.moviesSeen.length > 6 && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                +{stats.moviesSeen.length - 6} más
              </span>
            )}
          </div>
        </div>

        {/* Share button */}
        <button onClick={handleShare} disabled={sharing} style={{
          width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
          background: '#ff3b3b', color: '#fff', fontSize: 15, fontWeight: 700,
          cursor: sharing ? 'wait' : 'pointer', fontFamily: 'inherit',
          opacity: sharing ? 0.7 : 1, transition: 'opacity 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {sharing ? (
            <>
              <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Generando...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Compartir mi Wrapped
            </>
          )}
        </button>
      </div>
    ),
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: '#000',
      maxWidth: 430, margin: '0 auto',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Close button */}
      <button onClick={onClose} style={{
        position: 'absolute', top: 18, right: 18, zIndex: 10,
        background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer',
        width: 34, height: 34, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <line x1="18" y1="6" x2="6" y2="18" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <line x1="6" y1="6" x2="18" y2="18" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', top: 10, left: 16, right: 16, zIndex: 10,
        display: 'flex', gap: 4,
      }}>
        {Array.from({ length: totalSlides }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= currentSlide ? '#ff3b3b' : 'rgba(255,255,255,0.15)',
            transition: 'background 0.3s ease',
          }} />
        ))}
      </div>

      {/* Slide content — tap to navigate */}
      <div onClick={handleTap} style={{
        flex: 1, cursor: 'pointer', userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        background: 'radial-gradient(ellipse at center, rgba(255,59,59,0.06) 0%, transparent 70%)',
      }}>
        {slides[currentSlide]?.()}
      </div>
    </div>
  )
}

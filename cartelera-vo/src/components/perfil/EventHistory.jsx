import { useState } from 'react'

// Format date for display: "Sab 15 Mar · 19:30"
function formatEventDate(session) {
  if (!session?.date) return ''
  const [y, m, d] = session.date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const dayName = days[dt.getDay()]
  const monthName = months[m - 1]
  return `${dayName} ${d} ${monthName}${session.time ? ` · ${session.time}` : ''}`
}

// Resolve participant names from friends list
function resolveParticipants(plan, friends, userId) {
  const ids = plan.participants || [plan.initiator_id, plan.partner_id]
  return ids
    .filter(Boolean)
    .map(id => {
      if (id === userId || id === 'demo-local-user') return 'Tú'
      const friend = (friends || []).find(f => f.id === id)
      if (friend) return friend.nombre_display || friend.nombre
      if (plan.partner && plan.partner.id === id) return plan.partner.nombre_display || plan.partner.nombre
      return null
    })
    .filter(Boolean)
}

export default function EventHistory({ pastPlans, friends, user, movies, onClose, onShowWrapped }) {
  const userId = user?.id || 'demo-local-user'

  // Sort by date descending (most recent first)
  const sorted = [...pastPlans].sort((a, b) => {
    const dA = a.chosen_session?.date || ''
    const dB = b.chosen_session?.date || ''
    if (dA !== dB) return dB.localeCompare(dA)
    return (b.chosen_session?.time || '').localeCompare(a.chosen_session?.time || '')
  })

  // Get poster from movies list
  const getPoster = (title) => (movies || []).find(m => m.title === title)?.poster

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#000',
      display: 'flex', flexDirection: 'column',
      maxWidth: 430, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 20px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 6,
          color: '#fff', display: 'flex', alignItems: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <h1 style={{
          margin: 0, fontFamily: "'Archivo Black',sans-serif", fontWeight: 400,
          fontSize: 18, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Historial
        </h1>
        <div style={{ width: 34 }} /> {/* spacer for centering */}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 100px' }}>

        {/* Wrapped entry point */}
        {onShowWrapped && sorted.length > 0 && (
          <button onClick={onShowWrapped} style={{
            width: '100%', marginBottom: 20, padding: '16px 18px',
            borderRadius: 16, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #ff3b3b 0%, #cc2020 100%)',
            display: 'flex', alignItems: 'center', gap: 14,
            fontFamily: 'inherit',
          }}>
            <span style={{ fontSize: 28 }}>✨</span>
            <div style={{ textAlign: 'left' }}>
              <p style={{
                margin: 0, fontFamily: "'Archivo Black',sans-serif", fontWeight: 400,
                fontSize: 15, color: '#fff', letterSpacing: '0.02em',
              }}>
                VER TU WRAPPED {new Date().getFullYear()}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                Tu resumen cinéfilo del año
              </p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto' }}>
              <polyline points="9,18 15,12 9,6" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {/* Empty state */}
        {sorted.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '80px 30px',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
            <p style={{
              margin: '0 0 8px', fontFamily: "'Archivo Black',sans-serif", fontWeight: 400,
              fontSize: 18, color: '#fff',
            }}>
              Todavía no tienes eventos
            </p>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
              Cuando vayas al cine con amigos a través de VOSE, tus planes aparecerán aquí.
            </p>
          </div>
        )}

        {/* Event list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sorted.map(plan => {
            const poster = getPoster(plan.movie_title)
            const dateStr = formatEventDate(plan.chosen_session)
            const names = resolveParticipants(plan, friends, userId)
            const rating = plan.ratings?.[userId]?.rating

            return (
              <div key={plan.id} style={{
                display: 'flex', gap: 14, alignItems: 'center',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 16, padding: 12,
              }}>
                {/* Poster thumbnail */}
                <div style={{
                  width: 50, height: 75, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                  background: 'linear-gradient(145deg,#1a1a1a,#111)',
                }}>
                  {poster ? (
                    <img src={poster} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 4,
                    }}>
                      <span style={{ fontSize: 20 }}>🎬</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: '0 0 3px', fontFamily: "'Archivo Black',sans-serif", fontWeight: 400,
                    fontSize: 14, color: '#fff',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {plan.movie_title}
                  </p>
                  <p style={{ margin: '0 0 2px', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    {dateStr}
                  </p>
                  {plan.chosen_session?.cinema && (
                    <p style={{ margin: '0 0 4px', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                      {plan.chosen_session.cinema}
                    </p>
                  )}

                  {/* Rating stars */}
                  {rating && (
                    <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <span key={s} style={{ fontSize: 11, color: s <= rating ? '#ffd60a' : 'rgba(255,255,255,0.1)' }}>★</span>
                      ))}
                    </div>
                  )}

                  {/* Participants */}
                  {names.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Avatar circles */}
                      <div style={{ display: 'flex', marginLeft: 0 }}>
                        {names.slice(0, 4).map((name, i) => (
                          <div key={i} style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: ['#ff3b3b', '#ff6b6b', '#cc2020', '#993030'][i % 4],
                            border: '2px solid #000',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginLeft: i > 0 ? -6 : 0,
                            zIndex: 4 - i,
                            position: 'relative',
                          }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>
                              {name === 'Tú' ? '🤟' : name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        {names.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

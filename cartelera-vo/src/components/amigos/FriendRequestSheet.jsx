import { useState, useEffect } from 'react'

/**
 * FriendRequestSheet — Bottom sheet popup for pending friend requests
 * Shows one request at a time with large avatar, name, and accept/reject buttons.
 * Slides up from the bottom with a backdrop overlay.
 */

// Confetti for accept celebration
function MiniConfetti({ onDone }) {
  const emojis = ['🎉','🤝','✨','🎊','⭐','💫','🍿','🎬']
  const [particles] = useState(() =>
    Array.from({ length: 16 }, (_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      x: 20 + Math.random() * 60,
      delay: Math.random() * 0.4,
      duration: 1.2 + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 60,
      size: 16 + Math.random() * 12,
    }))
  )
  useEffect(() => {
    const t = setTimeout(onDone, 2000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden',zIndex:20}}>
      <style>{`
        @keyframes confettiPop {
          0% { transform: translateY(0) translateX(0) scale(1) rotate(0deg); opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translateY(-160px) translateX(var(--drift)) scale(0.2) rotate(420deg); opacity: 0; }
        }
      `}</style>
      {particles.map(p => (
        <span key={p.id} style={{
          position:'absolute', left:`${p.x}%`, bottom:'30%',
          fontSize: p.size,
          '--drift': `${p.drift}px`,
          animation: `confettiPop ${p.duration}s ease-out ${p.delay}s forwards`,
          opacity: 0,
        }}>{p.emoji}</span>
      ))}
    </div>
  )
}

export default function FriendRequestSheet({ requests, onAccept, onReject, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [celebrating, setCelebrating] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [closing, setClosing] = useState(false)

  // Reset index when requests change
  useEffect(() => {
    if (currentIndex >= requests.length) {
      setCurrentIndex(Math.max(0, requests.length - 1))
    }
  }, [requests.length, currentIndex])

  if (!requests || requests.length === 0) return null

  const req = requests[currentIndex]
  if (!req) return null

  const name = req.nombre_display || req.nombre || "Usuario"
  const initial = name.charAt(0).toUpperCase()
  const remaining = requests.length - currentIndex

  function handleAccept() {
    setCelebrating(true)
    onAccept(req.friendshipId)
    // After celebration, move to next or close
    setTimeout(() => {
      setCelebrating(false)
      if (currentIndex + 1 < requests.length) {
        setCurrentIndex(i => i + 1)
      } else {
        handleClose()
      }
    }, 1800)
  }

  function handleReject() {
    setDismissing(true)
    onReject(req.friendshipId)
    setTimeout(() => {
      setDismissing(false)
      if (currentIndex + 1 < requests.length) {
        setCurrentIndex(i => i + 1)
      } else {
        handleClose()
      }
    }, 400)
  }

  function handleClose() {
    setClosing(true)
    setTimeout(() => onClose(), 300)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: closing ? 'fadeOut 0.3s ease forwards' : 'fadeIn 0.3s ease',
        }}
      />

      {/* Bottom sheet */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 1000,
        animation: closing ? 'slideDown 0.3s ease forwards' : 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          @keyframes slideDown {
            from { transform: translateY(0); }
            to { transform: translateY(100%); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
          @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 0 20px rgba(52,199,89,0.3); }
            50% { box-shadow: 0 0 30px rgba(52,199,89,0.5); }
          }
        `}</style>

        <div style={{
          background: 'linear-gradient(180deg, #1a1a1a 0%, #111 100%)',
          borderRadius: '24px 24px 0 0',
          padding: '12px 24px 36px',
          maxHeight: '70vh',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Confetti overlay */}
          {celebrating && <MiniConfetti onDone={() => {}} />}

          {/* Drag handle */}
          <div style={{
            width: 40, height: 4, borderRadius: 2,
            background: 'rgba(255,255,255,0.15)',
            margin: '0 auto 20px',
          }} />

          {/* Counter badge */}
          {remaining > 1 && (
            <div style={{
              position: 'absolute', top: 20, right: 24,
              background: 'rgba(255,59,59,0.15)',
              border: '1px solid rgba(255,59,59,0.3)',
              borderRadius: 12, padding: '4px 10px',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ff3b3b' }}>
                {remaining} pendientes
              </span>
            </div>
          )}

          {/* Avatar — large and centered */}
          <div style={{
            textAlign: 'center',
            transform: dismissing ? 'translateX(-120%) rotate(-10deg)' : celebrating ? 'scale(1.1)' : 'none',
            opacity: dismissing ? 0 : 1,
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <div style={{
              width: 96, height: 96,
              borderRadius: '50%', margin: '0 auto 16px',
              overflow: 'hidden',
              border: celebrating ? '3px solid #34c759' : '3px solid rgba(255,255,255,0.12)',
              background: 'linear-gradient(135deg, #2a2a2a, #1a1a1a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 0.3s ease',
              boxShadow: celebrating ? '0 0 30px rgba(52,199,89,0.4)' : '0 4px 20px rgba(0,0,0,0.3)',
            }}>
              {req.avatar_url ? (
                <img src={req.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 40, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{initial}</span>
              )}
            </div>

            {/* Name */}
            <h2 style={{
              margin: '0 0 4px',
              fontSize: 24, fontWeight: 300,
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.06em',
              color: celebrating ? '#34c759' : '#fff',
              transition: 'color 0.3s ease',
            }}>
              {celebrating ? '¡Amigos! 🤝' : name}
            </h2>

            <p style={{
              margin: '0 0 28px',
              fontSize: 13, color: 'rgba(255,255,255,0.4)',
            }}>
              {celebrating ? `${name} y tú ya sois amigos` : 'Quiere ser tu amigo en VOSE'}
            </p>
          </div>

          {/* Action buttons */}
          {!celebrating && (
            <div style={{
              display: 'flex', gap: 12,
              animation: 'fadeIn 0.3s ease 0.2s both',
            }}>
              {/* Reject */}
              <button
                onClick={handleReject}
                style={{
                  flex: 1,
                  padding: '16px 0',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 15, fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                No gracias
              </button>

              {/* Accept */}
              <button
                onClick={handleAccept}
                style={{
                  flex: 2,
                  padding: '16px 0',
                  borderRadius: 16,
                  background: '#34c759',
                  border: 'none',
                  color: '#fff',
                  fontSize: 15, fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  animation: 'pulseGlow 2s ease-in-out infinite',
                  WebkitTapHighlightColor: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>🤝</span>
                Aceptar
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

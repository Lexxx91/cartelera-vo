import { useState, useEffect, useCallback } from 'react'

const PLAN_CARD_COPY = [
  "Chacho, nos vamos pal cine",
  "Esto si que es un planazo",
  "El cine mola mas en VO, bro",
  "Que suene bien, que suene original",
  "VO manda, bro",
]

export default function PlanConfirmedOverlay({ plan, posterUrl, onClose, user }) {
  const [cardBlob, setCardBlob] = useState(null)
  const [cardUrl, setCardUrl] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [headerCopy] = useState(() => PLAN_CARD_COPY[Math.floor(Math.random() * PLAN_CARD_COPY.length)])

  // Build participants list for the card (include current user!)
  const participants = []
  // Current user first
  if (user) {
    participants.push({
      name: 'Tú',
      avatar_url: user?.user_metadata?.avatar_url || null,
    })
  }
  // Partner
  if (plan.partner) {
    participants.push({
      name: plan.partner.nombre_display || plan.partner.nombre || 'Amigo',
      avatar_url: plan.partner.avatar_url,
    })
  }
  // Extra participants from participantProfiles (skip self & partner)
  if (plan.participantProfiles) {
    plan.participantProfiles.forEach(p => {
      if (p.id === user?.id) return
      if (plan.partner && p.id === plan.partner.id) return
      if (!participants.find(x => x.name === (p.nombre_display || p.nombre))) {
        participants.push({ name: p.nombre_display || p.nombre, avatar_url: p.avatar_url })
      }
    })
  }

  const session = plan.chosen_session

  // Generate PNG card via canvas
  const generateCard = useCallback(async () => {
    const W = 390 * 2 // 2x for retina
    const H = 680 * 2
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    // Wait for fonts
    try { await document.fonts.ready } catch(e) {}

    // Scale for retina
    const s = 2

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#0a0a0a')
    grad.addColorStop(0.4, '#111')
    grad.addColorStop(1, '#1a0808')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Decorative red circle top-right
    ctx.beginPath()
    ctx.arc(W - 40 * s, 60 * s, 100 * s, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,59,59,0.06)'
    ctx.fill()

    // Decorative red circle bottom-left
    ctx.beginPath()
    ctx.arc(30 * s, H - 80 * s, 80 * s, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,59,59,0.04)'
    ctx.fill()

    // "VAMOS PAL CINE" header
    ctx.fillStyle = '#ff3b3b'
    ctx.font = `400 ${28 * s}px 'Archivo Black', sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('VAMOS PAL CINE', W / 2, 52 * s)

    // Tagline copy
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `500 ${12 * s}px 'DM Sans', sans-serif`
    ctx.fillText(headerCopy, W / 2, 74 * s)

    // Poster (if available)
    let posterY = 100 * s
    const posterW = 160 * s
    const posterH = 240 * s
    const posterX = (W - posterW) / 2

    if (posterUrl) {
      try {
        const img = await loadImage(posterUrl)
        // Draw poster with rounded corners
        ctx.save()
        roundRect(ctx, posterX, posterY, posterW, posterH, 12 * s)
        ctx.clip()
        ctx.drawImage(img, posterX, posterY, posterW, posterH)
        ctx.restore()

        // Poster border
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'
        ctx.lineWidth = 1 * s
        roundRect(ctx, posterX, posterY, posterW, posterH, 12 * s)
        ctx.stroke()
      } catch(e) {
        // Poster failed to load — draw placeholder
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        roundRect(ctx, posterX, posterY, posterW, posterH, 12 * s)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.font = `400 ${14 * s}px 'Archivo Black', sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(plan.movie_title, W / 2, posterY + posterH / 2)
      }
    } else {
      // No poster URL — draw title placeholder
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      roundRect(ctx, posterX, posterY, posterW, posterH, 12 * s)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1 * s
      roundRect(ctx, posterX, posterY, posterW, posterH, 12 * s)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = `400 ${14 * s}px 'Archivo Black', sans-serif`
      ctx.textAlign = 'center'
      const titleLines = wrapText(ctx, plan.movie_title, posterW - 20 * s)
      titleLines.forEach((line, i) => {
        ctx.fillText(line, W / 2, posterY + posterH / 2 - ((titleLines.length - 1) * 10 * s) + i * 20 * s)
      })
    }

    // Movie title below poster
    const titleY = posterY + posterH + 28 * s
    ctx.fillStyle = '#fff'
    ctx.font = `400 ${15 * s}px 'Archivo Black', sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(plan.movie_title, W / 2, titleY)

    // Session info
    if (session) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = `600 ${13 * s}px 'DM Sans', sans-serif`
      const sessionText = `${session.day || session.date} · ${session.time}`
      ctx.fillText(sessionText, W / 2, titleY + 24 * s)

      if (session.cinema) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.font = `500 ${12 * s}px 'DM Sans', sans-serif`
        ctx.fillText(session.cinema, W / 2, titleY + 44 * s)
      }
    }

    // Participants
    const partY = titleY + 72 * s
    const avatarSize = 32 * s
    const totalParticipants = participants.length
    const avatarGap = 10 * s
    const totalAvatarsW = totalParticipants * avatarSize + (totalParticipants - 1) * avatarGap
    let avatarStartX = (W - totalAvatarsW) / 2

    for (let i = 0; i < participants.length; i++) {
      const ax = avatarStartX + i * (avatarSize + avatarGap)
      const ay = partY

      // Draw avatar circle
      ctx.save()
      ctx.beginPath()
      ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
      ctx.fillStyle = '#1a1a1a'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 1.5 * s
      ctx.stroke()

      // Try to draw avatar image
      if (participants[i].avatar_url) {
        try {
          const avImg = await loadImage(participants[i].avatar_url)
          ctx.beginPath()
          ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2 - 1, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(avImg, ax, ay, avatarSize, avatarSize)
        } catch(e) {
          // Fallback to initial
          ctx.fillStyle = 'rgba(255,255,255,0.7)'
          ctx.font = `700 ${14 * s}px 'DM Sans', sans-serif`
          ctx.textAlign = 'center'
          ctx.fillText(participants[i].name.charAt(0).toUpperCase(), ax + avatarSize / 2, ay + avatarSize / 2 + 5 * s)
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = `700 ${14 * s}px 'DM Sans', sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(participants[i].name.charAt(0).toUpperCase(), ax + avatarSize / 2, ay + avatarSize / 2 + 5 * s)
      }
      ctx.restore()

      // Name below avatar
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = `600 ${10 * s}px 'DM Sans', sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(participants[i].name.split(' ')[0], ax + avatarSize / 2, ay + avatarSize + 16 * s)
    }

    // "Unite al plan" invitation text
    const inviteY = partY + avatarSize + 50 * s
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font = `600 ${12 * s}px 'DM Sans', sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('Apuntate al plan:', W / 2, inviteY)

    // Deep link URL (prominent)
    ctx.fillStyle = 'rgba(255,59,59,0.7)'
    ctx.font = `600 ${11 * s}px 'DM Sans', sans-serif`
    ctx.fillText(`cartelera-vo.vercel.app?plan=${plan.id}`, W / 2, inviteY + 20 * s)

    // Footer: VOSE logo
    const footerY = H - 60 * s
    ctx.fillStyle = '#fff'
    ctx.font = `400 ${18 * s}px 'Archivo Black', sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('VO', W / 2 - 12 * s, footerY)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fillText('SE', W / 2 + 14 * s, footerY)

    // Convert to blob
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png')
    })
  }, [plan, posterUrl, session, participants, headerCopy])

  // Generate card immediately on mount
  useEffect(() => {
    generateCard().then(blob => {
      if (blob) {
        setCardBlob(blob)
        setCardUrl(URL.createObjectURL(blob))
      }
    })
  }, [generateCard])

  // Cleanup blob URL
  useEffect(() => {
    return () => { if (cardUrl) URL.revokeObjectURL(cardUrl) }
  }, [cardUrl])

  // Share handler
  async function handleShare() {
    if (!cardBlob) return
    setSharing(true)
    try {
      const file = new File([cardBlob], 'vose-plan.png', { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'VOSE — Vamos pal cine',
          text: `${plan.movie_title} — ${session?.day || session?.date} a las ${session?.time}. Unite al plan: https://cartelera-vo.vercel.app?plan=${plan.id}`,
        })
      } else {
        // Fallback: download
        const a = document.createElement('a')
        a.href = cardUrl
        a.download = 'vose-plan.png'
        a.click()
      }
    } catch(e) {
      // User cancelled share or error
    } finally {
      setSharing(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.92)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
      animation: 'fadeIn 0.4s ease',
    }}>
      <div style={{ width: '100%', maxWidth: 340, animation: 'fadeIn 0.5s ease', textAlign: 'center' }}>
        {/* Header */}
        <h2 style={{
          textAlign: 'center', margin: '0 0 4px',
          fontFamily: "'Archivo Black', sans-serif",
          fontSize: 18, fontWeight: 400, color: '#fff',
          textTransform: 'uppercase', letterSpacing: '0.02em',
        }}>
          Plan confirmado
        </h2>
        <p style={{
          textAlign: 'center', margin: '0 0 2px',
          fontFamily: "'Archivo Black',sans-serif",
          fontSize: 20, fontWeight: 900, color: '#fff',
        }}>
          {plan.movie_title}
        </p>
        {session && (
          <p style={{
            textAlign: 'center', margin: '0 0 20px',
            fontSize: 13, color: 'rgba(255,255,255,0.4)',
          }}>
            {session.day || session.date} · {session.time} · {session.cinema}
          </p>
        )}

        {/* Card preview */}
        {cardUrl ? (
          <img
            src={cardUrl}
            alt="Plan card"
            style={{
              width: '100%', maxWidth: 300, borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.1)',
              margin: '0 auto 20px', display: 'block',
              boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
            }}
          />
        ) : (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{
              width: 28, height: 28,
              border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff',
              borderRadius: '50%', animation: 'spin 0.7s linear infinite',
              margin: '0 auto',
            }} />
            <p style={{ marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Generando tarjeta...</p>
          </div>
        )}

        {/* Action buttons */}
        {cardUrl && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={onClose}
              style={{
                padding: '13px 24px', borderRadius: 100,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cerrar
            </button>
            <button
              onClick={handleShare}
              disabled={sharing}
              style={{
                padding: '13px 28px', borderRadius: 100,
                background: '#ff3b3b', border: 'none',
                color: '#000', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                opacity: sharing ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {sharing ? 'Compartiendo...' : 'Invitar amigos'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

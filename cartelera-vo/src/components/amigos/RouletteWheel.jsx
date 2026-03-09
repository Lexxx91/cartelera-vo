import { useState, useRef, useEffect } from 'react'

const PRE_SPIN_COPY = [
  "Llego el momento incomodo...",
  "A ver quien afloja la cartera...",
  "Alguien tiene que pagar, chacho...",
  "Esto se pone interesante...",
]

const POST_SPIN_COPY = [
  "¡Te toca, chacho!",
  "Ni pa'l cine te libras",
  "¡A soltar la pasta!",
  "Invitas tu hoy, mano",
  "¡Rascate el bolsillo!",
  "El destino ha hablado",
]

const SEGMENT_COLORS = ['#ff3b3b', '#1a1a1a', '#cc2f2f', '#111111']

export default function RouletteWheel({ participants, onClose }) {
  const [spinning, setSpinning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [winnerIndex, setWinnerIndex] = useState(null)
  const [rotation, setRotation] = useState(0)
  const [preCopy] = useState(() => PRE_SPIN_COPY[Math.floor(Math.random() * PRE_SPIN_COPY.length)])
  const [postCopy] = useState(() => POST_SPIN_COPY[Math.floor(Math.random() * POST_SPIN_COPY.length)])
  const wheelRef = useRef(null)

  const n = participants.length
  const sliceAngle = 360 / n

  function spin() {
    if (spinning || finished) return
    const winner = Math.floor(Math.random() * n)
    setWinnerIndex(winner)
    setSpinning(true)

    // Calculate rotation so the winner lands at the top (under the pointer)
    // The pointer is at the top (12 o'clock). Each segment starts at (i * sliceAngle).
    // We want the center of the winner's segment to be at 0 degrees (top).
    const winnerCenter = winner * sliceAngle + sliceAngle / 2
    // Rotate so winnerCenter ends up at 360 (top), add extra full rotations for drama
    const extraSpins = 5 + Math.floor(Math.random() * 3) // 5-7 full rotations
    const targetRotation = 360 * extraSpins + (360 - winnerCenter)

    setRotation(targetRotation)

    setTimeout(() => {
      setSpinning(false)
      setFinished(true)
    }, 4200)
  }

  const winner = winnerIndex !== null ? participants[winnerIndex] : null

  return (
    <div style={{
      textAlign: 'center',
      padding: '0 0 10px',
      animation: 'fadeIn 0.4s ease',
    }}>
      {/* Pre-spin copy */}
      {!finished && (
        <p style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.5)',
          margin: '0 0 20px',
          fontStyle: 'italic',
          animation: 'fadeIn 0.5s ease both 0.2s',
        }}>
          {preCopy}
        </p>
      )}

      {/* Wheel container */}
      {!finished && (
        <div style={{ position: 'relative', width: 260, height: 260, margin: '0 auto 24px' }}>
          {/* Pointer triangle at top */}
          <div style={{
            position: 'absolute',
            top: -14,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '14px solid transparent',
            borderRight: '14px solid transparent',
            borderTop: '22px solid #ff3b3b',
            zIndex: 2,
            filter: 'drop-shadow(0 2px 6px rgba(255,59,59,0.5))',
          }} />

          {/* SVG Wheel */}
          <svg
            ref={wheelRef}
            width="260"
            height="260"
            viewBox="0 0 260 260"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
            }}
          >
            {participants.map((p, i) => {
              const startAngle = (i * sliceAngle - 90) * (Math.PI / 180)
              const endAngle = ((i + 1) * sliceAngle - 90) * (Math.PI / 180)
              const cx = 130, cy = 130, r = 125

              const x1 = cx + r * Math.cos(startAngle)
              const y1 = cy + r * Math.sin(startAngle)
              const x2 = cx + r * Math.cos(endAngle)
              const y2 = cy + r * Math.sin(endAngle)
              const largeArc = sliceAngle > 180 ? 1 : 0

              const midAngle = ((i * sliceAngle + sliceAngle / 2) - 90) * (Math.PI / 180)
              const textR = r * 0.62
              const tx = cx + textR * Math.cos(midAngle)
              const ty = cy + textR * Math.sin(midAngle)
              const textRotation = i * sliceAngle + sliceAngle / 2

              const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length]

              return (
                <g key={i}>
                  <path
                    d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`}
                    fill={color}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={tx}
                    y={ty}
                    fill="#fff"
                    fontSize={n <= 3 ? "14" : n <= 5 ? "12" : "10"}
                    fontWeight="700"
                    fontFamily="'DM Sans', sans-serif"
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${textRotation}, ${tx}, ${ty})`}
                  >
                    {p.name.length > 12 ? p.name.slice(0, 11) + '…' : p.name}
                  </text>
                </g>
              )
            })}
            {/* Center circle */}
            <circle cx="130" cy="130" r="22" fill="#111" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
            <text x="130" y="131" fill="#ff3b3b" fontSize="16" textAnchor="middle" dominantBaseline="central">🎬</text>
          </svg>
        </div>
      )}

      {/* Spin button */}
      {!spinning && !finished && (
        <button
          onClick={spin}
          style={{
            padding: '16px 48px',
            borderRadius: 14,
            background: '#ff3b3b',
            border: 'none',
            color: '#000',
            fontSize: 16,
            fontWeight: 800,
            fontFamily: "'Archivo Black', sans-serif",
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 12,
            animation: 'fadeIn 0.5s ease both 0.4s',
          }}
        >
          Girar la ruleta
        </button>
      )}

      {/* Winner reveal */}
      {finished && winner && (
        <div style={{ animation: 'fadeIn 0.6s ease', padding: '10px 0' }}>
          {/* Winner avatar */}
          <div style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            margin: '0 auto 16px',
            border: '4px solid #ff3b3b',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #1a1a1a, #111)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 40px rgba(255,59,59,0.3)',
            animation: 'fadeIn 0.5s ease both 0.2s',
          }}>
            {winner.avatar_url ? (
              <img src={winner.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 40, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                {winner.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Winner name */}
          <h2 style={{
            margin: '0 0 6px',
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: 32,
            color: '#ff3b3b',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            animation: 'fadeIn 0.5s ease both 0.4s',
          }}>
            {winner.name}
          </h2>

          {/* Post-spin copy */}
          <p style={{
            fontSize: 16,
            color: 'rgba(255,255,255,0.6)',
            margin: '0 0 28px',
            fontWeight: 600,
            animation: 'fadeIn 0.5s ease both 0.6s',
          }}>
            {postCopy}
          </p>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => {
                setFinished(false)
                setSpinning(false)
                setWinnerIndex(null)
                setRotation(0)
              }}
              style={{
                padding: '13px 24px',
                borderRadius: 100,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                animation: 'fadeIn 0.5s ease both 0.8s',
              }}
            >
              Girar otra vez
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '13px 24px',
                borderRadius: 100,
                background: '#ff3b3b',
                border: 'none',
                color: '#000',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                animation: 'fadeIn 0.5s ease both 0.8s',
              }}
            >
              Hecho
            </button>
          </div>
        </div>
      )}

      {/* Back button during spin */}
      {spinning && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '3px solid rgba(255,59,59,0.2)',
            borderTopColor: '#ff3b3b',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto',
          }} />
        </div>
      )}
    </div>
  )
}

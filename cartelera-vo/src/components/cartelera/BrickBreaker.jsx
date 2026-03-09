import { useRef, useEffect, useState, useCallback } from 'react'
import { SUPABASE_URL, SUPABASE_ANON } from '../../constants.js'

// ─── Brick Breaker — Cinema Edition ──────────────────────────────────────────
// Canvas game with leaderboard backed by Supabase game_scores table

const BRICK_ROWS = 4
const BRICK_COLS = 7
const BRICK_PAD = 4
const BALL_R = 6
const PADDLE_H = 12
const PADDLE_W = 80
const BALL_SPEED = 4.5
const BRICK_COLORS = ['#ff3b3b', 'rgba(255,255,255,0.35)', '#ff3b3b', 'rgba(255,255,255,0.18)']
const BRICK_POINTS = [10, 20, 10, 15]

const GAME_OVER_MSGS = [
  "¡Corte!",
  "Mejor que un doblaje de Sixtolo",
  "Ni Armiche rompia tantos ladrillos",
  "Eso es to-to-todo, amigos",
  "Fin de la sesion",
]
const WIN_MSGS = [
  "Director's cut desbloqueado",
  "Toma buena, chacho",
  "Aplausos en la sala",
]

export default function BrickBreaker({ user, onClose }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const gameRef = useRef(null)
  const [gameState, setGameState] = useState('idle') // idle | playing | gameOver | won
  const [score, setScore] = useState(0)
  const [leaderboard, setLeaderboard] = useState([])
  const [loadingRank, setLoadingRank] = useState(false)
  const [endMsg, setEndMsg] = useState('')

  const isDemoMode = user?.isDemo === true

  // ─── Init game state ────────────────────────────────────────────────
  const initGame = useCallback((canvas) => {
    const W = canvas.width
    const H = canvas.height
    const brickW = (W - BRICK_PAD * (BRICK_COLS + 1)) / BRICK_COLS
    const brickH = 18

    const bricks = []
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: BRICK_PAD + c * (brickW + BRICK_PAD),
          y: 40 + r * (brickH + BRICK_PAD),
          w: brickW,
          h: brickH,
          color: BRICK_COLORS[r],
          points: BRICK_POINTS[r],
          alive: true,
          flash: 0,
        })
      }
    }

    return {
      W, H,
      paddle: { x: W / 2 - PADDLE_W / 2, y: H - 30, w: PADDLE_W, h: PADDLE_H },
      ball: { x: W / 2, y: H - 30 - BALL_R - 2, dx: BALL_SPEED * 0.7, dy: -BALL_SPEED * 0.7 },
      bricks,
      score: 0,
      state: 'idle', // internal state for the game loop
      particles: [],
      speedMult: 1,
    }
  }, [])

  // ─── Canvas setup ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      // Store logical size
      canvas._logW = rect.width
      canvas._logH = rect.height
    }
    resize()

    const g = initGame({ width: container.getBoundingClientRect().width, height: container.getBoundingClientRect().height })
    gameRef.current = g

    let rafId
    const ctx = canvas.getContext('2d')

    function draw() {
      const g = gameRef.current
      if (!g) return
      const { W, H } = g
      ctx.clearRect(0, 0, W, H)

      // Background
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, W, H)

      // Bricks
      g.bricks.forEach(b => {
        if (!b.alive) return
        ctx.fillStyle = b.color
        if (b.flash > 0) {
          ctx.fillStyle = '#fff'
          b.flash--
        }
        ctx.beginPath()
        roundRect(ctx, b.x, b.y, b.w, b.h, 4)
        ctx.fill()
      })

      // Particles
      g.particles = g.particles.filter(p => p.life > 0)
      g.particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.1
        p.life--
        ctx.globalAlpha = p.life / p.maxLife
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, 3, 3)
      })
      ctx.globalAlpha = 1

      // Ball trail
      if (g.state === 'playing') {
        ctx.beginPath()
        ctx.arc(g.ball.x - g.ball.dx * 0.5, g.ball.y - g.ball.dy * 0.5, BALL_R * 0.7, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,59,59,0.25)'
        ctx.fill()
      }

      // Ball
      ctx.beginPath()
      ctx.arc(g.ball.x, g.ball.y, BALL_R, 0, Math.PI * 2)
      ctx.fillStyle = '#ff3b3b'
      ctx.fill()

      // Paddle
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      roundRect(ctx, g.paddle.x, g.paddle.y, g.paddle.w, g.paddle.h, 6)
      ctx.fill()

      // Score HUD
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '600 12px "DM Sans", sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`SCORE: ${g.score}`, 12, 24)

      // Idle hint
      if (g.state === 'idle') {
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.font = '500 14px "DM Sans", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Toca para lanzar', W / 2, H / 2 + 40)
      }
    }

    function update() {
      const g = gameRef.current
      if (!g || g.state !== 'playing') return

      // Move ball
      g.ball.x += g.ball.dx * g.speedMult
      g.ball.y += g.ball.dy * g.speedMult

      // Wall collisions
      if (g.ball.x - BALL_R <= 0 || g.ball.x + BALL_R >= g.W) {
        g.ball.dx = -g.ball.dx
        g.ball.x = Math.max(BALL_R, Math.min(g.W - BALL_R, g.ball.x))
      }
      if (g.ball.y - BALL_R <= 0) {
        g.ball.dy = Math.abs(g.ball.dy)
        g.ball.y = BALL_R
      }

      // Paddle collision
      if (
        g.ball.dy > 0 &&
        g.ball.y + BALL_R >= g.paddle.y &&
        g.ball.y + BALL_R <= g.paddle.y + g.paddle.h + 4 &&
        g.ball.x >= g.paddle.x - 4 &&
        g.ball.x <= g.paddle.x + g.paddle.w + 4
      ) {
        // Spin: offset from center of paddle affects dx
        const hitPos = (g.ball.x - g.paddle.x) / g.paddle.w // 0..1
        const angle = (hitPos - 0.5) * Math.PI * 0.7 // -70° to +70°
        const speed = Math.sqrt(g.ball.dx ** 2 + g.ball.dy ** 2)
        g.ball.dx = Math.sin(angle) * speed
        g.ball.dy = -Math.abs(Math.cos(angle) * speed)
        g.ball.y = g.paddle.y - BALL_R - 1
      }

      // Ball fell below
      if (g.ball.y - BALL_R > g.H) {
        g.state = 'gameOver'
        setGameState('gameOver')
        setScore(g.score)
        setEndMsg(GAME_OVER_MSGS[Math.floor(Math.random() * GAME_OVER_MSGS.length)])
        handleGameEnd(g.score)
        return
      }

      // Brick collisions
      let rowsCleared = new Set()
      g.bricks.forEach(b => {
        if (!b.alive) return
        if (
          g.ball.x + BALL_R > b.x &&
          g.ball.x - BALL_R < b.x + b.w &&
          g.ball.y + BALL_R > b.y &&
          g.ball.y - BALL_R < b.y + b.h
        ) {
          b.alive = false
          b.flash = 3
          g.ball.dy = -g.ball.dy
          g.score += b.points
          setScore(g.score)

          // Spawn particles
          for (let i = 0; i < 6; i++) {
            g.particles.push({
              x: b.x + b.w / 2,
              y: b.y + b.h / 2,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 3,
              color: b.color === '#ff3b3b' ? '#ff3b3b' : '#fff',
              life: 20 + Math.random() * 15,
              maxLife: 35,
            })
          }

          // Check if row is clear
          const rowIdx = Math.floor((b.y - 40) / (18 + BRICK_PAD))
          const rowBricks = g.bricks.filter(bb => Math.floor((bb.y - 40) / (18 + BRICK_PAD)) === rowIdx)
          if (rowBricks.every(bb => !bb.alive)) {
            rowsCleared.add(rowIdx)
          }
        }
      })

      // Row clear bonus
      if (rowsCleared.size > 0) {
        g.score += rowsCleared.size * 50
        setScore(g.score)
        g.speedMult = Math.min(1.6, g.speedMult + rowsCleared.size * 0.1)
      }

      // Win check
      if (g.bricks.every(b => !b.alive)) {
        g.state = 'won'
        setGameState('won')
        setScore(g.score)
        setEndMsg(WIN_MSGS[Math.floor(Math.random() * WIN_MSGS.length)])
        handleGameEnd(g.score)
      }
    }

    function gameLoop() {
      update()
      draw()
      rafId = requestAnimationFrame(gameLoop)
    }
    rafId = requestAnimationFrame(gameLoop)

    return () => cancelAnimationFrame(rafId)
  }, [initGame])

  // ─── Pointer / Touch control ────────────────────────────────────────
  function handlePointerMove(e) {
    const g = gameRef.current
    const canvas = canvasRef.current
    if (!g || !canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left
    if (x === undefined) return

    g.paddle.x = Math.max(0, Math.min(g.W - g.paddle.w, x - g.paddle.w / 2))

    // In idle, ball follows paddle
    if (g.state === 'idle') {
      g.ball.x = g.paddle.x + g.paddle.w / 2
    }
  }

  function handleTap() {
    const g = gameRef.current
    if (!g) return

    if (g.state === 'idle') {
      g.state = 'playing'
      setGameState('playing')
      // Random angle between 30° and 150°
      const angle = (0.3 + Math.random() * 0.4) * Math.PI
      g.ball.dx = Math.cos(angle) * BALL_SPEED
      g.ball.dy = -Math.abs(Math.sin(angle) * BALL_SPEED)
    }
  }

  // ─── Game end → save score + load leaderboard ───────────────────────
  async function handleGameEnd(finalScore) {
    if (finalScore <= 0) return
    setLoadingRank(true)

    try {
      // Save score (upsert — only if higher)
      if (!isDemoMode && user?.id) {
        const currentRes = await fetch(
          `${SUPABASE_URL}/rest/v1/game_scores?user_id=eq.${user.id}&select=score`,
          { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
        )
        const current = await currentRes.json()
        const currentScore = current?.[0]?.score || 0

        if (finalScore > currentScore) {
          await fetch(`${SUPABASE_URL}/rest/v1/game_scores`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_ANON,
              Authorization: `Bearer ${SUPABASE_ANON}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify({ user_id: user.id, score: finalScore }),
          })
        }
      }

      // Load leaderboard
      const lbRes = await fetch(
        `${SUPABASE_URL}/rest/v1/leaderboard?order=score.desc&limit=10`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
      )
      if (lbRes.ok) {
        const lb = await lbRes.json()
        setLeaderboard(lb)
      }
    } catch (err) {
      console.warn('Leaderboard error:', err)
    } finally {
      setLoadingRank(false)
    }
  }

  // ─── Restart ────────────────────────────────────────────────────────
  function handleRestart() {
    const container = containerRef.current
    if (!container) return
    const g = initGame({ width: container.getBoundingClientRect().width, height: container.getBoundingClientRect().height })
    gameRef.current = g
    setGameState('idle')
    setScore(0)
    setLeaderboard([])
  }

  // ─── Leaderboard overlay ────────────────────────────────────────────
  function renderLeaderboard() {
    const isGameEnd = gameState === 'gameOver' || gameState === 'won'
    if (!isGameEnd) return null

    const medals = ['🥇', '🥈', '🥉']
    const myId = user?.id

    return (
      <div style={{
        position: 'absolute', inset: 0, zIndex: 20,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '24px 20px',
        animation: 'fadeIn 0.4s ease',
        borderRadius: 14,
      }}>
        {/* End message */}
        <p style={{ margin: '0 0 4px', fontSize: 32 }}>🎬</p>
        <h3 style={{
          margin: '0 0 4px', fontSize: 20, fontWeight: 900,
          fontFamily: "'Archivo Black', sans-serif", color: '#fff',
          textTransform: 'uppercase', letterSpacing: '0.02em',
        }}>
          {endMsg}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 28, fontWeight: 900, color: '#ff3b3b', fontFamily: "'Archivo Black', sans-serif" }}>
          {score} pts
        </p>

        {/* Leaderboard */}
        <div style={{ width: '100%', maxWidth: 300 }}>
          <p style={{
            margin: '0 0 12px', fontSize: 11, fontWeight: 700,
            color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
            letterSpacing: '0.12em', textAlign: 'center',
          }}>
            Ranking VOSE
          </p>

          {loadingRank && (
            <div style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
            </div>
          )}

          {!loadingRank && leaderboard.length === 0 && (
            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: '8px 0' }}>
              Se el primero en el ranking
            </p>
          )}

          {!loadingRank && leaderboard.map((entry, i) => {
            const isMe = entry.user_id === myId
            return (
              <div key={entry.user_id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 10,
                background: isMe ? 'rgba(255,59,59,0.12)' : 'transparent',
                border: isMe ? '1px solid rgba(255,59,59,0.3)' : '1px solid transparent',
                marginBottom: 4,
              }}>
                {/* Rank */}
                <span style={{ fontSize: 14, width: 24, textAlign: 'center', flexShrink: 0 }}>
                  {i < 3 ? medals[i] : <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{i + 1}</span>}
                </span>

                {/* Avatar */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                  background: 'linear-gradient(135deg,#1a1a1a,#111)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {entry.avatar_url ? (
                    <img src={entry.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                      {(entry.nombre_display || '?').charAt(0)}
                    </span>
                  )}
                </div>

                {/* Name */}
                <span style={{
                  flex: 1, fontSize: 13, fontWeight: isMe ? 700 : 500,
                  color: isMe ? '#fff' : 'rgba(255,255,255,0.6)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {isMe ? 'Tu' : (entry.nombre_display || 'Cinero')}
                </span>

                {/* Score */}
                <span style={{
                  fontSize: 13, fontWeight: 800, flexShrink: 0,
                  color: isMe ? '#ff3b3b' : 'rgba(255,255,255,0.5)',
                }}>
                  {entry.score}
                </span>
              </div>
            )
          })}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, width: '100%', maxWidth: 300 }}>
          <button onClick={handleRestart} style={{
            flex: 1, padding: '12px 16px', borderRadius: 12,
            background: '#ff3b3b', border: 'none',
            color: '#000', fontSize: 14, fontWeight: 800,
            fontFamily: "'Archivo Black', sans-serif",
            cursor: 'pointer', textTransform: 'uppercase',
          }}>
            Otra vez
          </button>
          <button onClick={onClose} style={{
            padding: '12px 16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer',
          }}>
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 0, minHeight: 0 }}>
      {/* Game header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 4px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>
          SCORE: {score}
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          padding: '4px 8px',
        }}>
          ✕ Cerrar
        </button>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        style={{
          flex: 1, position: 'relative', borderRadius: 14,
          overflow: 'hidden', background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.06)',
          minHeight: 0,
        }}
        onPointerMove={handlePointerMove}
        onTouchMove={(e) => { e.preventDefault(); handlePointerMove(e) }}
        onClick={handleTap}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
        />
        {renderLeaderboard()}
      </div>
    </div>
  )
}

// Canvas rounded rect helper
function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
}

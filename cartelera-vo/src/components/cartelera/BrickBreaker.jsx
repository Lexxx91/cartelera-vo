import { useRef, useEffect, useState, useCallback } from 'react'
import { SUPABASE_URL, SUPABASE_ANON } from '../../constants.js'
import { CAMPAIGNS, getActiveCampaign } from '../../campaigns.js'

// ─── Brick Breaker — Cinema Edition ──────────────────────────────────────────
// Canvas game with levels + leaderboard backed by Supabase game_scores table

// ─── Game constants ─────────────────────────────────────────────────────────
const BRICK_PAD = 4
const BALL_R = 6
const PADDLE_H = 12
const PADDLE_W = 80
const BALL_SPEED = 4.5
const BRICK_COLORS = ['#ff3b3b', 'rgba(255,255,255,0.35)', '#ff3b3b', 'rgba(255,255,255,0.18)', '#ff3b3b', 'rgba(255,255,255,0.25)']
const BRICK_POINTS = [10, 20, 10, 15, 10, 20]

// Level definitions
const LEVELS = [
  { rows: 4, cols: 7, speedMult: 1.0,  multiHitRatio: 0,    indestructible: 0 },
  { rows: 5, cols: 7, speedMult: 1.15, multiHitRatio: 0.25, indestructible: 0 },
  { rows: 5, cols: 8, speedMult: 1.3,  multiHitRatio: 0.4,  indestructible: 1 },
  { rows: 6, cols: 8, speedMult: 1.45, multiHitRatio: 0.5,  indestructible: 0 },
]

function getLevelConfig(level) {
  if (level <= LEVELS.length) return LEVELS[level - 1]
  return {
    rows: 6, cols: 8,
    speedMult: 1 + level * 0.15,
    multiHitRatio: Math.min(0.8, 0.3 + level * 0.1),
    indestructible: Math.min(3, Math.floor(level / 3)),
  }
}

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
const LEVEL_UP_MSGS = [
  "Preparate...",
  "Esto se pone serio, chacho",
  "Pal siguiente nivel",
  "Vamos alla",
]

export default function BrickBreaker({ user, onClose, campaignOverrides }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const gameRef = useRef(null)
  const [gameState, setGameState] = useState('idle') // idle | playing | gameOver | won | levelComplete
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [showLevelTransition, setShowLevelTransition] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])
  const [loadingRank, setLoadingRank] = useState(false)
  const [endMsg, setEndMsg] = useState('')

  const isDemoMode = user?.isDemo === true

  // ─── Campaign state ───────────────────────────────────────────────
  const campaignRef = useRef(getActiveCampaign(campaignOverrides))
  const brandImgRef = useRef(null)      // normal brick image (processed)
  const multiHitImgRef = useRef(null)   // multi-hit brick image (processed)

  // Track active campaign id as state to trigger image reloads
  const [activeCampaignId, setActiveCampaignId] = useState(() => getActiveCampaign(campaignOverrides)?.id || null)

  // Keep campaign in sync when overrides arrive from Supabase
  useEffect(() => {
    const newCampaign = getActiveCampaign(campaignOverrides)
    campaignRef.current = newCampaign
    const newId = newCampaign?.id || null
    if (newId !== activeCampaignId) {
      setActiveCampaignId(newId)
      // Reset image refs so they reload for the new campaign
      brandImgRef.current = null
      multiHitImgRef.current = null
    }
  }, [campaignOverrides])

  // Load campaign images — re-runs when active campaign changes
  useEffect(() => {
    const campaign = campaignRef.current
    if (!campaign?.brickImage) return

    // Process image: remove white background → transparent
    function processImage(src, ref) {
      const img = new Image()
      img.onload = () => {
        const oc = document.createElement('canvas')
        oc.width = img.width
        oc.height = img.height
        const octx = oc.getContext('2d')
        octx.drawImage(img, 0, 0)
        const id = octx.getImageData(0, 0, oc.width, oc.height)
        const d = id.data
        for (let i = 0; i < d.length; i += 4) {
          // White-ish pixels → transparent
          if (d[i] > 235 && d[i+1] > 235 && d[i+2] > 235) {
            d[i+3] = 0
          }
          // Near-white → semi-transparent (smooth edges)
          else if (d[i] > 210 && d[i+1] > 210 && d[i+2] > 210) {
            d[i+3] = Math.floor(255 * (1 - (d[i] - 210) / 45))
          }
        }
        octx.putImageData(id, 0, 0)
        ref.current = oc
      }
      img.onerror = () => { ref.current = null }
      img.src = src
    }

    processImage(campaign.brickImage, brandImgRef)
    if (campaign.multiHitImage) {
      processImage(campaign.multiHitImage, multiHitImgRef)
    }
  }, [activeCampaignId])

  // ─── Init game state ────────────────────────────────────────────────
  const initGame = useCallback((canvas, currentLevel = 1, carryScore = 0) => {
    const W = canvas.width
    const H = canvas.height
    const config = getLevelConfig(currentLevel)
    const campaign = campaignRef.current
    const activeCols = campaign?.brickCols || config.cols
    const brickW = (W - BRICK_PAD * (activeCols + 1)) / activeCols
    // Si hay imageCrop, calcular alto proporcional al paquete (no estirar)
    const crop = campaign?.imageCrop
    const brickH = crop
      ? Math.round(brickW * (crop.sh / crop.sw))
      : (campaign?.brickHeight || 16)

    const bricks = []
    let indestructiblePlaced = 0
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < activeCols; c++) {
        const colorIdx = r % BRICK_COLORS.length
        let hits = 1

        // Multi-hit bricks based on level ratio (skip first row)
        if (r > 0 && Math.random() < config.multiHitRatio) {
          hits = currentLevel >= 4 ? (Math.random() < 0.3 ? 3 : 2) : 2
        }

        // Indestructible bricks (placed in middle rows)
        let isIndestructible = false
        if (indestructiblePlaced < config.indestructible && r >= 1 && r <= config.rows - 2 && Math.random() < 0.2) {
          isIndestructible = true
          indestructiblePlaced++
          hits = 999
        }

        bricks.push({
          x: BRICK_PAD + c * (brickW + BRICK_PAD),
          y: 14 + r * (brickH + BRICK_PAD),
          w: brickW,
          h: brickH,
          color: isIndestructible ? 'rgba(255,255,255,0.08)' : BRICK_COLORS[colorIdx],
          baseColor: BRICK_COLORS[colorIdx],
          points: isIndestructible ? 0 : BRICK_POINTS[colorIdx] * (hits > 1 ? 2 : 1),
          alive: true,
          flash: 0,
          hits,
          maxHits: hits,
          indestructible: isIndestructible,
        })
      }
    }

    return {
      W, H,
      paddle: { x: W / 2 - PADDLE_W / 2, y: H - 22, w: PADDLE_W, h: PADDLE_H },
      ball: { x: W / 2, y: H - 22 - BALL_R - 2, dx: BALL_SPEED * 0.7, dy: -BALL_SPEED * 0.7 },
      bricks,
      score: carryScore,
      state: 'idle', // internal state for the game loop
      particles: [],
      speedMult: config.speedMult,
      level: currentLevel,
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
      canvas._logW = rect.width
      canvas._logH = rect.height
    }
    resize()

    const g = initGame({ width: container.getBoundingClientRect().width, height: container.getBoundingClientRect().height }, 1, 0)
    gameRef.current = g

    let rafId
    const ctx = canvas.getContext('2d')

    function draw() {
      const g = gameRef.current
      if (!g) return
      const { W, H } = g
      const campaign = campaignRef.current
      const brandImg = brandImgRef.current
      const multiHitImg = multiHitImgRef.current
      const isBranded = !!(campaign && brandImg)

      ctx.clearRect(0, 0, W, H)

      // Background
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, W, H)

      // Bricks
      g.bricks.forEach(b => {
        if (!b.alive) return

        // Indestructible — same style regardless of campaign
        if (b.indestructible) {
          if (isBranded) {
            // Campaign: bloque sólido oscuro con borde dorado para que no parezca un hueco
            ctx.fillStyle = 'rgba(40,32,20,0.7)'
            ctx.strokeStyle = 'rgba(212,167,72,0.5)'
            ctx.lineWidth = 1.5
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.06)'
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'
            ctx.lineWidth = 1
          }
          ctx.beginPath()
          roundRect(ctx, b.x, b.y, b.w, b.h, 4)
          ctx.fill()
          ctx.stroke()
          // Icono candado (🔒) centrado
          if (isBranded) {
            ctx.fillStyle = 'rgba(212,167,72,0.4)'
            ctx.font = `${Math.min(b.w, b.h) * 0.4}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('🔒', b.x + b.w / 2, b.y + b.h / 2)
          }
          return
        }

        if (isBranded) {
          // ── Campaign brick: draw brand image ──
          // Choose image: multi-hit → pink package, normal → yellow package
          const brickImg = (b.maxHits > 1 && multiHitImg) ? multiHitImg : brandImg
          const crop = campaign.imageCrop

          if (b.flash > 0) {
            b.flash--
            ctx.globalAlpha = 0.6
            ctx.save()
            ctx.beginPath()
            roundRect(ctx, b.x, b.y, b.w, b.h, 4)
            ctx.clip()
            if (crop) {
              ctx.drawImage(brickImg, crop.sx, crop.sy, crop.sw, crop.sh, b.x, b.y, b.w, b.h)
            } else {
              ctx.drawImage(brickImg, b.x, b.y, b.w, b.h)
            }
            ctx.restore()
            ctx.globalAlpha = 1
          } else {
            // Dim alpha for multi-hit damage
            if (b.maxHits > 1 && b.hits < b.maxHits) {
              ctx.globalAlpha = 0.4 + (b.hits / b.maxHits) * 0.6
            }
            ctx.save()
            ctx.beginPath()
            roundRect(ctx, b.x, b.y, b.w, b.h, 4)
            ctx.clip()
            if (crop) {
              ctx.drawImage(brickImg, crop.sx, crop.sy, crop.sw, crop.sh, b.x, b.y, b.w, b.h)
            } else {
              ctx.drawImage(brickImg, b.x, b.y, b.w, b.h)
            }
            ctx.restore()
            ctx.globalAlpha = 1
          }
        } else {
          // ── Original brick rendering ──
          ctx.fillStyle = b.flash > 0 ? '#fff' : b.color
          if (b.flash > 0) b.flash--
          ctx.beginPath()
          roundRect(ctx, b.x, b.y, b.w, b.h, 4)
          ctx.fill()

          // Multi-hit border indicator
          if (b.maxHits > 1 && b.hits > 0 && !b.indestructible) {
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = b.hits >= 3 ? 2.5 : 1.5
            ctx.stroke()
          }
        }
      })

      // Particles
      g.particles = g.particles.filter(p => p.life > 0)
      g.particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += (p.gravity ?? 0.1) // default = original gravity
        p.vx *= (p.drag ?? 1)      // air resistance for campaign particles
        p.life--
        if (p.size) p.size *= (p.shrink ?? 1) // shrinking for campaign dust clouds

        ctx.globalAlpha = p.life / p.maxLife
        ctx.fillStyle = p.color

        if (p.size) {
          // Campaign: circle particle (dust cloud)
          ctx.beginPath()
          ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2)
          ctx.fill()
        } else {
          // Original: 3x3 square particle
          ctx.fillRect(p.x, p.y, 3, 3)
        }
      })
      ctx.globalAlpha = 1

      // Ball trail
      if (g.state === 'playing') {
        ctx.beginPath()
        ctx.arc(g.ball.x - g.ball.dx * 0.5, g.ball.y - g.ball.dy * 0.5, BALL_R * 0.7, 0, Math.PI * 2)
        ctx.fillStyle = isBranded ? campaign.ball.trail : 'rgba(255,59,59,0.25)'
        ctx.fill()
      }

      // Ball
      ctx.beginPath()
      ctx.arc(g.ball.x, g.ball.y, BALL_R, 0, Math.PI * 2)
      if (isBranded && campaign.ball.type === 'stone') {
        // ── Campaign: stone ball with radial gradient ──
        const bc = campaign.ball.colors
        const stoneGrad = ctx.createRadialGradient(
          g.ball.x - 1.5, g.ball.y - 1.5, 0,
          g.ball.x, g.ball.y, BALL_R
        )
        stoneGrad.addColorStop(0, bc.center)
        stoneGrad.addColorStop(0.5, bc.mid)
        stoneGrad.addColorStop(0.85, bc.edge)
        stoneGrad.addColorStop(1, bc.rim)
        ctx.fillStyle = stoneGrad
        ctx.fill()
        // Subtle dark rim
        ctx.strokeStyle = 'rgba(60,50,40,0.5)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      } else {
        // ── Original: red ball ──
        ctx.fillStyle = '#ff3b3b'
        ctx.fill()
      }

      // Paddle
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      roundRect(ctx, g.paddle.x, g.paddle.y, g.paddle.w, g.paddle.h, 6)
      ctx.fill()

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
      const campaign = campaignRef.current
      const brandImg = brandImgRef.current
      const isBranded = !!(campaign && brandImg)
      // brickH: usar el alto real del primer ladrillo (ya calculado en initGame)
      const brickH = g.bricks[0]?.h || 16

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
        const hitPos = (g.ball.x - g.paddle.x) / g.paddle.w
        const angle = (hitPos - 0.5) * Math.PI * 0.7
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
          if (b.indestructible) {
            // Bounce off but don't destroy
            g.ball.dy = -g.ball.dy
            b.flash = 3
            return
          }

          b.hits--
          g.ball.dy = -g.ball.dy

          if (b.hits <= 0) {
            b.alive = false
            g.score += b.points
            setScore(g.score)

            if (isBranded) {
              // ── Campaign particles: gofio dust ──
              const dustColors = campaign.dustColors

              // Dust clouds — big circles floating UP
              for (let i = 0; i < 8; i++) {
                g.particles.push({
                  x: b.x + Math.random() * b.w,
                  y: b.y + Math.random() * b.h,
                  vx: (Math.random() - 0.5) * 2.5,
                  vy: -(Math.random() * 2 + 0.5),
                  gravity: -0.02,
                  drag: 0.98,
                  color: dustColors[Math.floor(Math.random() * dustColors.length)],
                  life: 30 + Math.random() * 20,
                  maxLife: 50,
                  size: 4 + Math.random() * 2,
                  shrink: 0.97,
                })
              }

              // Fast specks — tiny squares shooting upward
              for (let i = 0; i < 6; i++) {
                g.particles.push({
                  x: b.x + b.w / 2,
                  y: b.y + b.h / 2,
                  vx: (Math.random() - 0.5) * 5,
                  vy: -(Math.random() * 4 + 1),
                  gravity: 0,
                  drag: 0.96,
                  color: dustColors[Math.floor(Math.random() * dustColors.length)],
                  life: 15 + Math.random() * 10,
                  maxLife: 25,
                  // no size → renders as original 3x3 square style but smaller handled by life
                })
              }
            } else {
              // ── Original particles ──
              for (let i = 0; i < 6; i++) {
                g.particles.push({
                  x: b.x + b.w / 2,
                  y: b.y + b.h / 2,
                  vx: (Math.random() - 0.5) * 4,
                  vy: (Math.random() - 0.5) * 3,
                  color: b.baseColor === '#ff3b3b' ? '#ff3b3b' : '#fff',
                  life: 20 + Math.random() * 15,
                  maxLife: 35,
                })
              }
            }

            // Check if row is clear
            const rowIdx = Math.floor((b.y - 14) / (brickH + BRICK_PAD))
            const rowBricks = g.bricks.filter(bb => Math.floor((bb.y - 14) / (brickH + BRICK_PAD)) === rowIdx && !bb.indestructible)
            if (rowBricks.every(bb => !bb.alive)) {
              rowsCleared.add(rowIdx)
            }
          } else {
            b.flash = 3
            // Visual feedback: dim color to show remaining hits
            const ratio = b.hits / b.maxHits
            if (b.baseColor === '#ff3b3b') {
              b.color = `rgba(255,59,59,${0.4 + ratio * 0.6})`
            } else {
              b.color = `rgba(255,255,255,${0.12 + ratio * 0.23})`
            }
          }
        }
      })

      // Row clear bonus (scales with level)
      if (rowsCleared.size > 0) {
        const levelBonus = 50 + (g.level - 1) * 10
        g.score += rowsCleared.size * levelBonus
        setScore(g.score)
      }

      // Win check — only count non-indestructible bricks
      if (g.bricks.filter(b => !b.indestructible).every(b => !b.alive)) {
        g.state = 'levelComplete'
        setGameState('levelComplete')
        setScore(g.score)

        // Trigger level transition
        const nextLevel = g.level + 1
        setShowLevelTransition(true)
        setLevel(nextLevel)

        setTimeout(() => {
          setShowLevelTransition(false)
          const container = containerRef.current
          if (!container) return
          const newG = initGame(
            { width: container.getBoundingClientRect().width, height: container.getBoundingClientRect().height },
            nextLevel,
            g.score
          )
          gameRef.current = newG
          setGameState('idle')
        }, 2000)
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
      const angle = (0.3 + Math.random() * 0.4) * Math.PI
      g.ball.dx = Math.cos(angle) * BALL_SPEED
      g.ball.dy = -Math.abs(Math.sin(angle) * BALL_SPEED)
    }
  }

  // ─── Game end → save score + load leaderboard ───────────────────────
  async function handleGameEnd(finalScore) {
    if (finalScore <= 0) return
    setLoadingRank(true)

    // Build fallback entry for current user (always shown if DB fails)
    const myEntry = {
      user_id: user?.id || 'demo',
      score: finalScore,
      nombre_display: user?.user_metadata?.full_name || 'Tu',
      avatar_url: user?.user_metadata?.avatar_url || null,
    }

    try {
      // Save score (upsert — only if higher)
      if (!isDemoMode && user?.id) {
        const currentRes = await fetch(
          `${SUPABASE_URL}/rest/v1/game_scores?user_id=eq.${user.id}&game_type=eq.breakout&select=score`,
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
            body: JSON.stringify({ user_id: user.id, score: finalScore, game_type: 'breakout' }),
          })
        }
      }

      // Load leaderboard
      const lbRes = await fetch(
        `${SUPABASE_URL}/rest/v1/leaderboard?game_type=eq.breakout&order=score.desc&limit=10`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
      )
      if (lbRes.ok) {
        const lb = await lbRes.json()
        if (Array.isArray(lb) && lb.length > 0) {
          setLeaderboard(lb)
        } else {
          // DB returned empty — show self as fallback
          setLeaderboard([myEntry])
        }
      } else {
        // DB query failed — show self as fallback
        setLeaderboard([myEntry])
      }
    } catch (err) {
      console.warn('Leaderboard error:', err)
      // Network error — show self as fallback
      setLeaderboard([myEntry])
    } finally {
      setLoadingRank(false)
    }
  }

  // ─── Restart ────────────────────────────────────────────────────────
  function handleRestart() {
    const container = containerRef.current
    if (!container) return
    const g = initGame({ width: container.getBoundingClientRect().width, height: container.getBoundingClientRect().height }, 1, 0)
    gameRef.current = g
    setGameState('idle')
    setScore(0)
    setLevel(1)
    setLeaderboard([])
  }

  // ─── Leaderboard overlay ────────────────────────────────────────────
  function renderLeaderboard() {
    const isGameEnd = gameState === 'gameOver'
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
          margin: '0 0 4px', fontSize: 18, fontWeight: 900,
          fontFamily: "'Archivo Black', sans-serif", color: '#fff',
          textTransform: 'uppercase', letterSpacing: '0.02em',
        }}>
          {endMsg}
        </h3>
        <p style={{ margin: '0 0 4px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          Nivel {level} alcanzado
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 28, fontWeight: 900, color: '#ff3b3b', fontFamily: "'Archivo Black', sans-serif" }}>
          {score} pts
        </p>

        {/* Leaderboard */}
        <div style={{ width: '100%', maxWidth: 300 }}>
          <p style={{
            margin: '0 0 10px', fontSize: 11, fontWeight: 700,
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
                padding: '7px 12px', borderRadius: 10,
                background: isMe ? 'rgba(255,59,59,0.12)' : 'transparent',
                border: isMe ? '1px solid rgba(255,59,59,0.3)' : '1px solid transparent',
                marginBottom: 3,
              }}>
                <span style={{ fontSize: 14, width: 24, textAlign: 'center', flexShrink: 0 }}>
                  {i < 3 ? medals[i] : <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{i + 1}</span>}
                </span>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                  background: 'linear-gradient(135deg,#1a1a1a,#111)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {entry.avatar_url ? (
                    <img src={entry.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                      {(entry.nombre_display || '?').charAt(0)}
                    </span>
                  )}
                </div>
                <span style={{
                  flex: 1, fontSize: 13, fontWeight: isMe ? 700 : 500,
                  color: isMe ? '#fff' : 'rgba(255,255,255,0.6)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {isMe ? 'Tu' : (entry.nombre_display || 'Cinero')}
                </span>
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
        <div style={{ display: 'flex', gap: 10, marginTop: 16, width: '100%', maxWidth: 300 }}>
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
    <div style={{
      display: 'flex', flexDirection: 'column', flex: 1, gap: 0, minHeight: 0,
      maxHeight: 'calc(100vh - 56px - 56px - 70px)',
    }}>
      {/* Game header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 4px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>
          NIVEL {level} · {score} pts
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

        {/* Level transition overlay */}
        {showLevelTransition && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 25,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.3s ease',
            borderRadius: 14,
          }}>
            <p style={{
              fontSize: 48, fontWeight: 900,
              fontFamily: "'Archivo Black', sans-serif",
              color: '#ff3b3b', textTransform: 'uppercase',
              letterSpacing: '0.05em', margin: 0,
            }}>
              NIVEL {level}
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
              {LEVEL_UP_MSGS[Math.floor(Math.random() * LEVEL_UP_MSGS.length)]}
            </p>
          </div>
        )}
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

import { useRef, useEffect, useState, useCallback } from 'react'
import { SUPABASE_URL, SUPABASE_ANON } from '../../constants.js'
import { getActiveCampaign } from '../../campaigns.js'

// ─── Snake de Chorizo de Teror ──────────────────────────────────────────────
// Canvas game — eat papas arrugadas, grab mojo rojo for x2, don't crash.

// ─── Constants ───────────────────────────────────────────────────────────────
const CELL_SIZE = 18
const INITIAL_INTERVAL = 180
const MIN_INTERVAL = 80
const SPEED_DECREASE = 5
const PAPA_SCORE = 10
const MOJO_SCORE = 25
const MOJO_EVERY = 8       // papas eaten before mojo spawns
const MOJO_DURATION = 5000 // ms before mojo disappears
const MOJO_MULTI_DUR = 5000 // x2 multiplier duration
const SWIPE_THRESHOLD = 10

const GAME_OVER_MSGS = [
  'El chorizo no da pa\' más',
  'Ni en la feria de Teror hacen cadenas tan largas',
  'Se te fue el chorizo, bro',
  'Más largo que un día sin mojo',
  'Chorizo KO',
  'Ese chorizo se pasó de rosca',
  'Pa\'l frigorífico',
]

// ─── Directions ──────────────────────────────────────────────────────────────
const DIR = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] }
const opposite = (a, b) => a[0] + b[0] === 0 && a[1] + b[1] === 0

export default function SnakeGame({ user, onClose, campaignOverrides }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const animFrameRef = useRef(null)
  const moveTimerRef = useRef(null)
  const touchStartRef = useRef(null)

  const [score, setScore] = useState(0)
  const [gameState, setGameState] = useState('idle') // idle | playing | gameOver
  const [endMsg, setEndMsg] = useState('')
  const [leaderboard, setLeaderboard] = useState([])
  const [loadingRank, setLoadingRank] = useState(false)

  const isDemoMode = !user?.id || user.id === 'demo-local-user'

  // ─── Init game state ───────────────────────────────────────────────────
  function initGame(w, h) {
    const dpr = window.devicePixelRatio || 1
    const cols = Math.floor(w / CELL_SIZE)
    const rows = Math.floor(h / CELL_SIZE)
    // Center the grid in the canvas
    const offsetX = Math.floor((w - cols * CELL_SIZE) / 2)
    const offsetY = Math.floor((h - rows * CELL_SIZE) / 2)

    const midX = Math.floor(cols / 2)
    const midY = Math.floor(rows / 2)
    const snake = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY },
    ]

    return {
      w, h, dpr, cols, rows, offsetX, offsetY,
      snake,
      dir: [...DIR.RIGHT],
      nextDir: [...DIR.RIGHT],
      papa: spawnPickup(cols, rows, snake, null),
      mojo: null,
      mojoTimer: null,
      papasEaten: 0,
      score: 0,
      interval: INITIAL_INTERVAL,
      multiplier: 1,
      multiplierEnd: 0,
      particles: [],
      mojoFlashAlpha: 0,
      // Smooth movement lerp
      moveProgress: 1,     // 0→1 lerp between ticks
      prevPositions: null,  // previous snake positions for lerp
      started: false,       // tracks if game has begun (for draw overlay)
      alive: true,
    }
  }

  // ─── Spawn pickup at random free cell ──────────────────────────────────
  function spawnPickup(cols, rows, snake, excludePos) {
    const occupied = new Set(snake.map(s => `${s.x},${s.y}`))
    if (excludePos) occupied.add(`${excludePos.x},${excludePos.y}`)
    const free = []
    for (let x = 0; x < cols; x++)
      for (let y = 0; y < rows; y++)
        if (!occupied.has(`${x},${y}`)) free.push({ x, y })
    if (free.length === 0) return { x: 0, y: 0 }
    return free[Math.floor(Math.random() * free.length)]
  }

  // ─── Canvas setup ──────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'

    const g = initGame(rect.width, rect.height)
    gameRef.current = g
    setScore(0)
    setGameState('idle')

    // Initial draw
    draw(g, canvas)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (moveTimerRef.current) clearInterval(moveTimerRef.current)
      const gRef = gameRef.current
      if (gRef?.mojoTimer) clearTimeout(gRef.mojoTimer)
    }
  }, [])

  // ─── Game loop (move tick) ─────────────────────────────────────────────
  function startGameLoop() {
    const g = gameRef.current
    if (!g) return

    if (moveTimerRef.current) clearInterval(moveTimerRef.current)

    moveTimerRef.current = setInterval(() => {
      const g = gameRef.current
      if (!g || !g.alive) return
      moveTick(g)
    }, g.interval)
  }

  function restartInterval() {
    const g = gameRef.current
    if (!g || !g.alive) return
    if (moveTimerRef.current) clearInterval(moveTimerRef.current)
    moveTimerRef.current = setInterval(() => {
      const g = gameRef.current
      if (!g || !g.alive) return
      moveTick(g)
    }, g.interval)
  }

  // ─── Move tick ─────────────────────────────────────────────────────────
  function moveTick(g) {
    // Save previous positions for lerp
    g.prevPositions = g.snake.map(s => ({ x: s.x, y: s.y }))
    g.moveProgress = 0

    // Apply queued direction
    g.dir = [...g.nextDir]

    const head = g.snake[0]
    const nx = head.x + g.dir[0]
    const ny = head.y + g.dir[1]

    // Wall collision
    if (nx < 0 || nx >= g.cols || ny < 0 || ny >= g.rows) {
      die(g)
      return
    }

    // Self collision (skip tail because it will move)
    for (let i = 0; i < g.snake.length - 1; i++) {
      if (g.snake[i].x === nx && g.snake[i].y === ny) {
        die(g)
        return
      }
    }

    // Move
    g.snake.unshift({ x: nx, y: ny })
    let ate = false

    // Papa collision
    if (nx === g.papa.x && ny === g.papa.y) {
      ate = true
      g.papasEaten++
      const pts = PAPA_SCORE * g.multiplier
      g.score += pts
      setScore(g.score)

      // Salt explosion particles
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 1 + Math.random() * 2.5
        g.particles.push({
          x: (g.papa.x + 0.5) * CELL_SIZE + g.offsetX,
          y: (g.papa.y + 0.5) * CELL_SIZE + g.offsetY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.02 + Math.random() * 0.02,
          size: 1.5 + Math.random() * 2,
          color: `rgba(255,255,255,${0.6 + Math.random() * 0.4})`,
          type: 'salt',
        })
      }

      // Spawn new papa
      g.papa = spawnPickup(g.cols, g.rows, g.snake, g.mojo)

      // Speed up
      g.interval = Math.max(MIN_INTERVAL, g.interval - SPEED_DECREASE)
      restartInterval()

      // Maybe spawn mojo
      if (g.papasEaten % MOJO_EVERY === 0 && !g.mojo) {
        g.mojo = spawnPickup(g.cols, g.rows, g.snake, g.papa)
        if (g.mojoTimer) clearTimeout(g.mojoTimer)
        g.mojoTimer = setTimeout(() => {
          if (gameRef.current) gameRef.current.mojo = null
        }, MOJO_DURATION)
      }
    }

    // Mojo collision
    if (g.mojo && nx === g.mojo.x && ny === g.mojo.y) {
      ate = true
      const pts = MOJO_SCORE * g.multiplier
      g.score += pts
      setScore(g.score)
      g.multiplier = 2
      g.multiplierEnd = Date.now() + MOJO_MULTI_DUR
      g.mojoFlashAlpha = 0.5

      // Red particles
      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 1.5 + Math.random() * 3
        g.particles.push({
          x: (g.mojo.x + 0.5) * CELL_SIZE + g.offsetX,
          y: (g.mojo.y + 0.5) * CELL_SIZE + g.offsetY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.015 + Math.random() * 0.015,
          size: 2 + Math.random() * 3,
          color: '#CC1100',
          type: 'mojo',
        })
      }

      if (g.mojoTimer) clearTimeout(g.mojoTimer)
      g.mojoTimer = null
      g.mojo = null
    }

    if (!ate) g.snake.pop() // remove tail if didn't eat

    // Check multiplier expiry
    if (g.multiplier > 1 && Date.now() > g.multiplierEnd) {
      g.multiplier = 1
    }
  }

  // ─── Die ───────────────────────────────────────────────────────────────
  function die(g) {
    g.alive = false
    if (moveTimerRef.current) clearInterval(moveTimerRef.current)
    if (g.mojoTimer) clearTimeout(g.mojoTimer)

    const msg = GAME_OVER_MSGS[Math.floor(Math.random() * GAME_OVER_MSGS.length)]
    setEndMsg(msg)
    setGameState('gameOver')
    handleGameEnd(g.score)
  }

  // ─── Render loop ───────────────────────────────────────────────────────
  useEffect(() => {
    let lastTime = 0
    function loop(time) {
      const g = gameRef.current
      const canvas = canvasRef.current
      if (!g || !canvas) return

      const dt = time - lastTime
      lastTime = time

      // Advance lerp
      if (g.alive && g.prevPositions) {
        g.moveProgress = Math.min(1, g.moveProgress + dt / g.interval)
      }

      // Fade mojo flash
      if (g.mojoFlashAlpha > 0) g.mojoFlashAlpha = Math.max(0, g.mojoFlashAlpha - 0.01)

      // Multiplier expiry check
      if (g.multiplier > 1 && Date.now() > g.multiplierEnd) g.multiplier = 1

      // Particles
      g.particles = g.particles.filter(p => {
        p.x += p.vx
        p.y += p.vy
        p.life -= p.decay
        p.vy += 0.03 // gravity
        return p.life > 0
      })

      draw(g, canvas)
      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [])

  // ─── Draw ──────────────────────────────────────────────────────────────
  function draw(g, canvas) {
    const ctx = canvas.getContext('2d')
    const dpr = g.dpr || (window.devicePixelRatio || 1)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, g.w, g.h)

    // Background
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, g.w, g.h)

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.015)'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= g.cols; x++) {
      const px = g.offsetX + x * CELL_SIZE
      ctx.beginPath(); ctx.moveTo(px, g.offsetY); ctx.lineTo(px, g.offsetY + g.rows * CELL_SIZE); ctx.stroke()
    }
    for (let y = 0; y <= g.rows; y++) {
      const py = g.offsetY + y * CELL_SIZE
      ctx.beginPath(); ctx.moveTo(g.offsetX, py); ctx.lineTo(g.offsetX + g.cols * CELL_SIZE, py); ctx.stroke()
    }

    // Mojo flash on borders
    if (g.mojoFlashAlpha > 0) {
      const gradient = ctx.createLinearGradient(0, 0, g.w, 0)
      gradient.addColorStop(0, `rgba(204,17,0,${g.mojoFlashAlpha})`)
      gradient.addColorStop(0.15, 'transparent')
      gradient.addColorStop(0.85, 'transparent')
      gradient.addColorStop(1, `rgba(204,17,0,${g.mojoFlashAlpha})`)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, g.w, g.h)
    }

    // Multiplier active glow
    if (g.multiplier > 1) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300)
      ctx.strokeStyle = `rgba(204,17,0,${0.15 + pulse * 0.1})`
      ctx.lineWidth = 2
      ctx.strokeRect(g.offsetX + 1, g.offsetY + 1, g.cols * CELL_SIZE - 2, g.rows * CELL_SIZE - 2)
    }

    // ─── Papa arrugada ─────────────────────────────────────────────────
    drawPapa(ctx, g, g.papa)

    // ─── Mojo rojo ─────────────────────────────────────────────────────
    if (g.mojo) drawMojo(ctx, g, g.mojo)

    // ─── Snake (chorizo) ───────────────────────────────────────────────
    drawSnake(ctx, g)

    // ─── Particles ─────────────────────────────────────────────────────
    g.particles.forEach(p => {
      ctx.globalAlpha = p.life
      if (p.type === 'salt') {
        ctx.fillStyle = p.color
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      } else {
        ctx.beginPath()
        ctx.fillStyle = p.color
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    })

    // ─── Tap to start overlay ──────────────────────────────────────────
    if (!g.started) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, 0, g.w, g.h)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#fff'
      ctx.font = "bold 16px 'Archivo Black', sans-serif"
      ctx.fillText('TOCA PARA EMPEZAR', g.w / 2, g.h / 2 - 14)
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '12px system-ui, sans-serif'
      ctx.fillText('Usa las flechas para girar', g.w / 2, g.h / 2 + 10)

      // Draw arrow hint pointing down at D-pad
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = '18px system-ui, sans-serif'
      const bounce = Math.sin(Date.now() / 400) * 3
      ctx.fillText('↓', g.w / 2, g.h / 2 + 34 + bounce)
    }

    // Multiplier badge
    if (g.multiplier > 1 && g.alive) {
      const badgeW = 54, badgeH = 22
      const bx = g.w - badgeW - 8, by = 8
      const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 200)
      ctx.globalAlpha = pulse
      ctx.fillStyle = '#CC1100'
      ctx.beginPath()
      roundRect(ctx, bx, by, badgeW, badgeH, 6)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = '#fff'
      ctx.font = "bold 12px 'Archivo Black', sans-serif"
      ctx.textAlign = 'center'
      ctx.fillText('x2', bx + badgeW / 2, by + 15)
      ctx.textAlign = 'start'
    }
  }

  // ─── Draw papa arrugada ────────────────────────────────────────────────
  function drawPapa(ctx, g, pos) {
    const cx = g.offsetX + (pos.x + 0.5) * CELL_SIZE
    const cy = g.offsetY + (pos.y + 0.5) * CELL_SIZE
    const r = CELL_SIZE * 0.38

    // Shadow
    ctx.beginPath()
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.ellipse(cx + 1, cy + 2, r * 1.1, r * 0.6, 0, 0, Math.PI * 2)
    ctx.fill()

    // Potato body — slightly irregular
    ctx.beginPath()
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r * 1.2)
    grad.addColorStop(0, '#d4b062')
    grad.addColorStop(0.6, '#C4A35A')
    grad.addColorStop(1, '#8B7355')
    ctx.fillStyle = grad
    ctx.ellipse(cx, cy, r * 1.1, r * 0.9, 0.15, 0, Math.PI * 2)
    ctx.fill()

    // Wrinkle lines
    ctx.strokeStyle = 'rgba(100,70,30,0.3)'
    ctx.lineWidth = 0.5
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      const wx = cx - r * 0.5 + i * r * 0.5
      ctx.moveTo(wx, cy - r * 0.4)
      ctx.quadraticCurveTo(wx + r * 0.1, cy, wx - r * 0.1, cy + r * 0.4)
      ctx.stroke()
    }

    // Salt crystals
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    const salts = [[0.2, -0.3], [-0.25, 0.1], [0.1, 0.25], [-0.1, -0.15], [0.3, 0.05]]
    salts.forEach(([sx, sy]) => {
      ctx.fillRect(cx + r * sx - 0.7, cy + r * sy - 0.7, 1.4, 1.4)
    })
  }

  // ─── Draw mojo rojo ───────────────────────────────────────────────────
  function drawMojo(ctx, g, pos) {
    const cx = g.offsetX + (pos.x + 0.5) * CELL_SIZE
    const cy = g.offsetY + (pos.y + 0.5) * CELL_SIZE
    const r = CELL_SIZE * 0.4

    // Pulsing glow
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200)
    ctx.beginPath()
    ctx.fillStyle = `rgba(204,17,0,${0.15 * pulse})`
    ctx.arc(cx, cy, r * 2, 0, Math.PI * 2)
    ctx.fill()

    // Drop shape
    ctx.beginPath()
    ctx.moveTo(cx, cy - r * 1.2)
    ctx.bezierCurveTo(cx + r * 1.0, cy - r * 0.2, cx + r * 0.9, cy + r * 0.8, cx, cy + r)
    ctx.bezierCurveTo(cx - r * 0.9, cy + r * 0.8, cx - r * 1.0, cy - r * 0.2, cx, cy - r * 1.2)
    const mojoGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.3, 0, cx, cy, r * 1.2)
    mojoGrad.addColorStop(0, '#ff3300')
    mojoGrad.addColorStop(0.5, '#CC1100')
    mojoGrad.addColorStop(1, '#880000')
    ctx.fillStyle = mojoGrad
    ctx.fill()

    // Shine
    ctx.beginPath()
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.ellipse(cx - r * 0.2, cy - r * 0.2, r * 0.25, r * 0.15, -0.5, 0, Math.PI * 2)
    ctx.fill()

    // x2 label
    ctx.fillStyle = '#fff'
    ctx.font = "bold 7px 'Archivo Black', sans-serif"
    ctx.textAlign = 'center'
    ctx.fillText('x2', cx, cy + r * 1.8)
    ctx.textAlign = 'start'
  }

  // ─── Direction between two segments ─────────────────────────────────
  function segDir(snake, i) {
    if (i === 0 && snake.length > 1) return [snake[0].x - snake[1].x, snake[0].y - snake[1].y]
    if (i > 0) return [snake[i - 1].x - snake[i].x, snake[i - 1].y - snake[i].y]
    return [1, 0]
  }

  // ─── Draw chorizo capsule (shared by head + body) ─────────────────────
  function drawCapsule(ctx, cx, cy, isHorizontal, w, h, color1, color2) {
    const hw = w / 2, hh = h / 2, r = Math.min(hw, hh)
    // Rounded rect path
    ctx.beginPath()
    roundRect(ctx, cx - hw, cy - hh, w, h, r)

    // Gradient — top-left highlight for 3D look
    const grad = ctx.createLinearGradient(cx - hw, cy - hh, cx + hw * 0.3, cy + hh)
    grad.addColorStop(0, color1)
    grad.addColorStop(0.5, color2)
    grad.addColorStop(1, shadeColor(color2, -25))
    ctx.fillStyle = grad
    ctx.fill()

    // Glossy highlight — elliptical shine on upper half
    ctx.save()
    ctx.beginPath()
    roundRect(ctx, cx - hw, cy - hh, w, h, r)
    ctx.clip()
    ctx.beginPath()
    const shineW = w * 0.5, shineH = h * 0.25
    ctx.ellipse(cx - hw * 0.1, cy - hh * 0.35, shineW, shineH, isHorizontal ? 0 : Math.PI / 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fill()
    ctx.restore()

    // Subtle casing texture — faint lines
    ctx.save()
    ctx.beginPath()
    roundRect(ctx, cx - hw, cy - hh, w, h, r)
    ctx.clip()
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 0.5
    const lineCount = 3
    for (let j = 1; j <= lineCount; j++) {
      ctx.beginPath()
      if (isHorizontal) {
        const ly = cy - hh + (h / (lineCount + 1)) * j
        ctx.moveTo(cx - hw, ly)
        ctx.lineTo(cx + hw, ly)
      } else {
        const lx = cx - hw + (w / (lineCount + 1)) * j
        ctx.moveTo(lx, cy - hh)
        ctx.lineTo(lx, cy + hh)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  // ─── Draw string tie between two positions ────────────────────────────
  function drawTie(ctx, x, y, isHorizontal) {
    ctx.save()
    // Twisted string knot
    const tw = isHorizontal ? 3 : CELL_SIZE * 0.5
    const th = isHorizontal ? CELL_SIZE * 0.5 : 3
    // String color
    ctx.strokeStyle = '#C4A56C'
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    // Cross pattern for twisted look
    if (isHorizontal) {
      ctx.beginPath()
      ctx.moveTo(x - 1, y - th * 0.3); ctx.lineTo(x + 1, y + th * 0.3)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x + 1, y - th * 0.3); ctx.lineTo(x - 1, y + th * 0.3)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.moveTo(x - tw * 0.3, y - 1); ctx.lineTo(x + tw * 0.3, y + 1)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x - tw * 0.3, y + 1); ctx.lineTo(x + tw * 0.3, y - 1)
      ctx.stroke()
    }
    // Small knot dot in center
    ctx.fillStyle = '#A8884C'
    ctx.beginPath()
    ctx.arc(x, y, 1.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // ─── Draw snake (chorizo) ──────────────────────────────────────────────
  function drawSnake(ctx, g) {
    const snake = g.snake
    const t = g.moveProgress != null ? g.moveProgress : 1
    const prev = g.prevPositions

    // First pass: draw ties between segments (behind the sausages)
    for (let i = 0; i < snake.length - 1; i++) {
      let sx1 = snake[i].x, sy1 = snake[i].y
      let sx2 = snake[i + 1].x, sy2 = snake[i + 1].y
      if (prev && prev[i] && prev[i + 1] && t < 1) {
        sx1 = prev[i].x + (snake[i].x - prev[i].x) * t
        sy1 = prev[i].y + (snake[i].y - prev[i].y) * t
        sx2 = prev[i + 1].x + (snake[i + 1].x - prev[i + 1].x) * t
        sy2 = prev[i + 1].y + (snake[i + 1].y - prev[i + 1].y) * t
      }
      const cx1 = g.offsetX + (sx1 + 0.5) * CELL_SIZE
      const cy1 = g.offsetY + (sy1 + 0.5) * CELL_SIZE
      const cx2 = g.offsetX + (sx2 + 0.5) * CELL_SIZE
      const cy2 = g.offsetY + (sy2 + 0.5) * CELL_SIZE
      const mx = (cx1 + cx2) / 2, my = (cy1 + cy2) / 2
      const isH = Math.abs(sx1 - sx2) > Math.abs(sy1 - sy2)
      drawTie(ctx, mx, my, isH)
    }

    // Second pass: draw sausage segments (on top of ties)
    for (let i = snake.length - 1; i >= 0; i--) {
      let sx = snake[i].x, sy = snake[i].y
      if (prev && prev[i] && t < 1) {
        sx = prev[i].x + (snake[i].x - prev[i].x) * t
        sy = prev[i].y + (snake[i].y - prev[i].y) * t
      }
      const cx = g.offsetX + (sx + 0.5) * CELL_SIZE
      const cy = g.offsetY + (sy + 0.5) * CELL_SIZE
      const isHead = i === 0
      const isTail = i === snake.length - 1
      const dir = segDir(snake, i)
      const isH = Math.abs(dir[0]) >= Math.abs(dir[1])

      // Capsule dimensions — wider along direction of travel
      const longSide = CELL_SIZE * 0.92
      const shortSide = CELL_SIZE * 0.7
      const w = isH ? longSide : shortSide
      const h = isH ? shortSide : longSide
      const scale = isTail ? 0.8 : 1

      // Chorizo colors: deep reddish-brown like real Chorizo de Teror
      const c1 = i % 2 === 0 ? '#9C5030' : '#8E4428'
      const c2 = i % 2 === 0 ? '#7A3520' : '#6E2C18'

      drawCapsule(ctx, cx, cy, isH, w * scale, h * scale, c1, c2)

      // Head extras: eyes + front tie knot
      if (isHead) {
        // Eyes
        const eFwd = isH ? (dir[0] > 0 ? 1 : -1) * CELL_SIZE * 0.22 : 0
        const eSide = isH ? 0 : (dir[1] > 0 ? 1 : -1) * CELL_SIZE * 0.22
        const ePerp = CELL_SIZE * 0.18
        let e1x, e1y, e2x, e2y
        if (isH) {
          e1x = cx + eFwd; e1y = cy - ePerp
          e2x = cx + eFwd; e2y = cy + ePerp
        } else {
          e1x = cx - ePerp; e1y = cy + eSide
          e2x = cx + ePerp; e2y = cy + eSide
        }
        // White
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.arc(e1x, e1y, 2, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(e2x, e2y, 2, 0, Math.PI * 2); ctx.fill()
        // Pupil
        ctx.fillStyle = '#1a0a00'
        ctx.beginPath(); ctx.arc(e1x + (dir[0]) * 0.6, e1y + (dir[1]) * 0.6, 1, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(e2x + (dir[0]) * 0.6, e2y + (dir[1]) * 0.6, 1, 0, Math.PI * 2); ctx.fill()
      }

      // Tail: extra knot at the end
      if (isTail) {
        const tieX = cx - dir[0] * CELL_SIZE * 0.35
        const tieY = cy - dir[1] * CELL_SIZE * 0.35
        drawTie(ctx, tieX, tieY, isH)
      }
    }
  }

  // ─── Touch handlers ────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e) => {
    // Let button taps through (game over overlay, close button, etc.)
    if (e.target.closest('button')) return
    e.preventDefault()
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (e.target.closest('button')) return
    e.preventDefault()
  }, [])

  const handleTouchEnd = useCallback((e) => {
    // Let button taps through
    if (e.target.closest('button')) return
    e.preventDefault()
    const g = gameRef.current
    if (!g) return

    if (gameState === 'idle') {
      setGameState('playing')
      g.alive = true
      g.started = true
      startGameLoop()
      return
    }

    if (!g.alive) return

    const start = touchStartRef.current
    if (!start) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y

    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return

    let newDir
    if (Math.abs(dx) > Math.abs(dy)) {
      newDir = dx > 0 ? DIR.RIGHT : DIR.LEFT
    } else {
      newDir = dy > 0 ? DIR.DOWN : DIR.UP
    }

    // Block 180° turns
    if (!opposite(g.dir, newDir)) {
      g.nextDir = [...newDir]
    }
  }, [gameState])

  // ─── Keyboard handler ──────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e) {
      const g = gameRef.current
      if (!g) return

      if (gameState === 'idle' && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
        setGameState('playing')
        g.alive = true
        startGameLoop()
        return
      }

      if (!g.alive) return

      const keyMap = { ArrowUp: DIR.UP, ArrowDown: DIR.DOWN, ArrowLeft: DIR.LEFT, ArrowRight: DIR.RIGHT }
      const newDir = keyMap[e.key]
      if (newDir && !opposite(g.dir, newDir)) {
        e.preventDefault()
        g.nextDir = [...newDir]
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [gameState])

  // ─── Tap to start (click/tap on container) ─────────────────────────────
  const handleTap = useCallback(() => {
    const g = gameRef.current
    if (!g) return

    if (gameState === 'idle') {
      setGameState('playing')
      g.alive = true
      g.started = true
      startGameLoop()
    }
  }, [gameState])

  // ─── D-pad handler (on-screen directional buttons) ───────────────────
  function handleDpad(newDir) {
    const g = gameRef.current
    if (!g) return

    // Start game on first interaction
    if (!g.started) {
      setGameState('playing')
      g.alive = true
      g.started = true
      startGameLoop()
      // Set initial direction if compatible (not 180° from default RIGHT)
      if (!opposite([1, 0], newDir)) {
        g.nextDir = [...newDir]
      }
      return
    }

    if (!g.alive) return

    if (!opposite(g.dir, newDir)) {
      g.nextDir = [...newDir]
    }
  }

  // ─── Score saving ──────────────────────────────────────────────────────
  async function handleGameEnd(finalScore) {
    setLoadingRank(true)

    const myEntry = {
      user_id: user?.id || 'demo',
      nombre_display: user?.user_metadata?.nombre_display || user?.user_metadata?.nombre || 'Tú',
      score: finalScore,
      avatar_url: user?.user_metadata?.avatar_url || null,
    }

    try {
      if (!isDemoMode && user?.id) {
        const currentRes = await fetch(
          `${SUPABASE_URL}/rest/v1/game_scores?user_id=eq.${user.id}&game_type=eq.snake&select=score`,
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
            body: JSON.stringify({ user_id: user.id, score: finalScore, game_type: 'snake' }),
          })
        }
      }

      // Load leaderboard
      const lbRes = await fetch(
        `${SUPABASE_URL}/rest/v1/leaderboard?game_type=eq.snake&order=score.desc&limit=10`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
      )
      if (lbRes.ok) {
        const lb = await lbRes.json()
        if (Array.isArray(lb) && lb.length > 0) {
          setLeaderboard(lb)
        } else {
          setLeaderboard([myEntry])
        }
      } else {
        setLeaderboard([myEntry])
      }
    } catch (err) {
      console.warn('Leaderboard error:', err)
      setLeaderboard([myEntry])
    } finally {
      setLoadingRank(false)
    }
  }

  // ─── Restart ───────────────────────────────────────────────────────────
  function handleRestart() {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    if (moveTimerRef.current) clearInterval(moveTimerRef.current)
    const g = initGame(rect.width, rect.height)
    gameRef.current = g
    setGameState('idle')
    setScore(0)
    setLeaderboard([])
  }

  // ─── Leaderboard overlay ───────────────────────────────────────────────
  function renderLeaderboard() {
    if (gameState !== 'gameOver') return null

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
        <p style={{ margin: '0 0 4px', fontSize: 32 }}>🌭</p>
        <h3 style={{
          margin: '0 0 4px', fontSize: 16, fontWeight: 900,
          fontFamily: "'Archivo Black', sans-serif", color: '#fff',
          textTransform: 'uppercase', letterSpacing: '0.02em',
          textAlign: 'center', lineHeight: 1.3,
        }}>
          {endMsg}
        </h3>
        <p style={{ margin: '0 0 4px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          {gameRef.current?.papasEaten || 0} papas comidas
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
            Otra partida
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

  // ─── Render ────────────────────────────────────────────────────────────
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
          SCORE · {score} pts{gameRef.current?.multiplier > 1 ? ' · x2' : ''}
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleTap}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
        />
        {renderLeaderboard()}
      </div>

      {/* D-pad directional controls */}
      {gameState !== 'gameOver' && (
        <div style={{
          display: 'flex', justifyContent: 'center',
          padding: '8px 0 2px', flexShrink: 0,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 52px)',
            gridTemplateRows: 'repeat(3, 44px)',
            gap: 3,
          }}>
            {/* Row 1: UP */}
            <div />
            <button
              onPointerDown={(e) => { e.preventDefault(); handleDpad(DIR.UP) }}
              style={{
                width: 52, height: 44, borderRadius: 10,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', touchAction: 'manipulation',
                WebkitUserSelect: 'none', userSelect: 'none',
                padding: 0, fontFamily: 'system-ui, sans-serif',
              }}
            >▲</button>
            <div />
            {/* Row 2: LEFT, center, RIGHT */}
            <button
              onPointerDown={(e) => { e.preventDefault(); handleDpad(DIR.LEFT) }}
              style={{
                width: 52, height: 44, borderRadius: 10,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', touchAction: 'manipulation',
                WebkitUserSelect: 'none', userSelect: 'none',
                padding: 0, fontFamily: 'system-ui, sans-serif',
              }}
            >◀</button>
            <div style={{
              width: 52, height: 44, borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>🌭</span>
            </div>
            <button
              onPointerDown={(e) => { e.preventDefault(); handleDpad(DIR.RIGHT) }}
              style={{
                width: 52, height: 44, borderRadius: 10,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', touchAction: 'manipulation',
                WebkitUserSelect: 'none', userSelect: 'none',
                padding: 0, fontFamily: 'system-ui, sans-serif',
              }}
            >▶</button>
            {/* Row 3: DOWN */}
            <div />
            <button
              onPointerDown={(e) => { e.preventDefault(); handleDpad(DIR.DOWN) }}
              style={{
                width: 52, height: 44, borderRadius: 10,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', touchAction: 'manipulation',
                WebkitUserSelect: 'none', userSelect: 'none',
                padding: 0, fontFamily: 'system-ui, sans-serif',
              }}
            >▼</button>
            <div />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Utility ─────────────────────────────────────────────────────────────
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
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + percent))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent))
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent))
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`
}

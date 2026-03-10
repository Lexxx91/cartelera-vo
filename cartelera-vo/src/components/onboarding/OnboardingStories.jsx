import { useState, useEffect, useRef, useCallback } from 'react'

const TOTAL_STORIES = 4
const STORY_DURATION = 7000 // 7 seconds per story

export default function OnboardingStories({ onComplete, onConnectWhatsApp }) {
  const [currentStory, setCurrentStory] = useState(0)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef(null)
  const startTimeRef = useRef(null)
  const elapsedRef = useRef(0)
  const pointerDownTimeRef = useRef(null) // Track actual pointer down time
  const pointerDownXRef = useRef(null) // Track pointer X position

  // Start/resume timer for current story
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      const elapsed = elapsedRef.current + (Date.now() - startTimeRef.current)
      const pct = Math.min(100, (elapsed / STORY_DURATION) * 100)
      setProgress(pct)
      if (pct >= 100) {
        clearInterval(timerRef.current)
        if (currentStory < TOTAL_STORIES - 1) {
          elapsedRef.current = 0
          setCurrentStory(c => c + 1)
          setProgress(0)
        }
        // Don't auto-complete on last story — user must tap CTA
      }
    }, 50)
  }, [currentStory])

  useEffect(() => {
    elapsedRef.current = 0
    setProgress(0)
    startTimer()
    return () => clearInterval(timerRef.current)
  }, [currentStory, startTimer])

  // Pause/resume on hold
  function handlePointerDown(e) {
    pointerDownTimeRef.current = Date.now()
    pointerDownXRef.current = e.clientX || e.touches?.[0]?.clientX || 0
    elapsedRef.current += Date.now() - startTimeRef.current
    clearInterval(timerRef.current)
  }

  function handlePointerUp(e) {
    const x = e.clientX || e.changedTouches?.[0]?.clientX || 0
    const mid = window.innerWidth / 2

    // Calculate how long the pointer was held down
    const holdDuration = Date.now() - (pointerDownTimeRef.current || Date.now())

    // Navigate on quick tap (< 250ms), ignore long holds (pauses)
    if (holdDuration < 250) {
      if (x < mid) {
        // Previous
        if (currentStory > 0) {
          elapsedRef.current = 0
          setCurrentStory(c => c - 1)
          return // startTimer called by useEffect
        }
      } else {
        // Next
        if (currentStory < TOTAL_STORIES - 1) {
          elapsedRef.current = 0
          setCurrentStory(c => c + 1)
          return // startTimer called by useEffect
        }
      }
    }
    // Resume timer if no navigation happened
    startTimer()
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#000",
        display: "flex", flexDirection: "column",
        fontFamily: "'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif",
        color: "#fff",
        userSelect: "none", WebkitUserSelect: "none",
        touchAction: "none",
        maxWidth: 430, margin: "0 auto",
      }}
    >
      <style>{`
        @keyframes swipeDemo {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          20% { transform: translateX(90px) rotate(7deg); }
          40% { transform: translateX(0) rotate(0deg); }
          60% { transform: translateX(-90px) rotate(-7deg); }
          80% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes stampIn {
          0% { opacity:0; transform:scale(0.5) rotate(-12deg); }
          50% { opacity:1; transform:scale(1.1) rotate(-12deg); }
          100% { opacity:0.85; transform:scale(1) rotate(-12deg); }
        }
        @keyframes slideInLeft {
          from { opacity:0; transform:translateX(-60px); }
          to { opacity:1; transform:translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity:0; transform:translateX(60px); }
          to { opacity:1; transform:translateX(0); }
        }
        @keyframes scaleBounce {
          0% { transform:scale(0); opacity:0; }
          60% { transform:scale(1.2); opacity:1; }
          100% { transform:scale(1); opacity:1; }
        }
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(16px); }
          to { opacity:1; transform:translateY(0); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(255,59,59,0.3); }
          50% { box-shadow: 0 0 40px rgba(255,59,59,0.6); }
        }
        @keyframes chatBubbleIn {
          from { opacity:0; transform:translateY(10px) scale(0.9); }
          to { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes strikethrough {
          from { width:0; }
          to { width:100%; }
        }
        @keyframes confettiPop {
          0% { transform:scale(0); opacity:0; }
          50% { transform:scale(1.3); opacity:1; }
          100% { transform:scale(1); opacity:1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fadeOut {
          from { opacity:1; }
          to { opacity:0; }
        }
        @keyframes glowGreen {
          0%, 100% { box-shadow: 0 0 20px rgba(37,211,102,0.3); }
          50% { box-shadow: 0 0 40px rgba(37,211,102,0.6); }
        }
        @keyframes goStale {
          from { filter: grayscale(0) brightness(1); border-color: rgba(37,211,102,0.3); }
          to { filter: grayscale(1) brightness(0.4); border-color: rgba(255,255,255,0.06); }
        }
      `}</style>

      {/* Progress bar */}
      <div style={{
        display: "flex", gap: 4, padding: "16px 16px 0",
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
      }}>
        {Array.from({ length: TOTAL_STORIES }, (_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: "rgba(255,255,255,0.2)", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 2,
              background: "#fff",
              width: i < currentStory ? "100%" : i === currentStory ? `${progress}%` : "0%",
              transition: i === currentStory ? "width 0.1s linear" : "none",
            }} />
          </div>
        ))}
      </div>

      {/* Skip button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onComplete()
        }}
        onPointerDown={e => e.stopPropagation()}
        onPointerUp={e => e.stopPropagation()}
        style={{
          position: "absolute", top: 28, right: 16, zIndex: 11,
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600,
          fontFamily: "inherit", padding: "6px 12px",
        }}
      >
        Saltar
      </button>

      {/* Story content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "60px 32px 40px",
        overflow: "hidden",
      }}>
        {currentStory === 0 && <StorySwipe />}
        {currentStory === 1 && <StoryMatch />}
        {currentStory === 2 && <StoryNoPingPong />}
        {currentStory === 3 && (
          <StoryVocito
            onConnect={(e) => {
              e.stopPropagation()
              onConnectWhatsApp?.()
              onComplete()
            }}
            onSkip={(e) => {
              e.stopPropagation()
              onComplete()
            }}
          />
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════ */
/* STORY 1: DESLIZA                       */
/* ═══════════════════════════════════════ */
function StorySwipe() {
  return (
    <div style={{ textAlign: "center", width: "100%" }}>
      <h1 style={{
        margin: "0 0 8px", fontFamily: "'Archivo Black',sans-serif",
        fontWeight: 400, fontSize: 42, color: "#fff",
        textTransform: "uppercase", letterSpacing: "-0.02em",
      }}>
        DESLIZA
      </h1>
      <p style={{
        margin: "0 0 40px", fontSize: 15, color: "rgba(255,255,255,0.5)",
        lineHeight: 1.5,
      }}>
        Derecha si quieres ir, izquierda si pasas
      </p>

      {/* Animated mock card */}
      <div style={{ position: "relative", height: 260, display: "flex", justifyContent: "center" }}>
        {/* PASO stamp (left) */}
        <div style={{
          position: "absolute", left: 20, top: "50%", transform: "translateY(-50%) rotate(-12deg)",
          fontSize: 28, fontWeight: 900, fontFamily: "'Archivo Black',sans-serif",
          color: "#ff453a",
          border: "3px solid #ff453a", borderRadius: 8, padding: "4px 14px",
        }}>
          PASO
        </div>

        {/* The card */}
        <div style={{
          width: 180, height: 260, borderRadius: 18,
          background: "linear-gradient(145deg, #1a1a1a, #111)",
          border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden", position: "relative",
          animation: "swipeDemo 4s ease-in-out infinite",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}>
          <div style={{
            width: "100%", height: "100%",
            background: "linear-gradient(180deg, #2a1a1a 0%, #0a0a0a 100%)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: 20,
          }}>
            <span style={{ fontSize: 48, marginBottom: 12 }}>🎬</span>
            <p style={{
              margin: 0, fontFamily: "'Archivo Black',sans-serif",
              fontSize: 14, color: "rgba(255,255,255,0.6)",
              textAlign: "center", textTransform: "uppercase",
            }}>
              Pelicula
            </p>
          </div>
        </div>

        {/* VOY stamp (right) */}
        <div style={{
          position: "absolute", right: 20, top: "50%", transform: "translateY(-50%) rotate(12deg)",
          fontSize: 28, fontWeight: 900, fontFamily: "'Archivo Black',sans-serif",
          color: "#34c759",
          border: "3px solid #34c759", borderRadius: 8, padding: "4px 14px",
        }}>
          VOY
        </div>
      </div>

      {/* Swipe indicators */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 40,
        marginTop: 32,
      }}>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 24 }}>👈</span>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>PASO</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 24 }}>👉</span>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>VOY</p>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════ */
/* STORY 2: COINCIDE CON AMIGOS           */
/* ═══════════════════════════════════════ */
function StoryMatch() {
  return (
    <div style={{ textAlign: "center", width: "100%" }}>
      <h1 style={{
        margin: "0 0 8px", fontFamily: "'Archivo Black',sans-serif",
        fontWeight: 400, fontSize: 32, color: "#fff",
        textTransform: "uppercase", letterSpacing: "-0.02em",
        lineHeight: 1,
      }}>
        <span style={{ display: "block" }}>COINCIDE CON</span>
        <span style={{ display: "block", color: "#ff3b3b" }}>AMIGOS</span>
      </h1>
      <p style={{
        margin: "0 0 40px", fontSize: 14, color: "rgba(255,255,255,0.5)",
        lineHeight: 1.5,
      }}>
        Cuando tu y un amigo deslizais la misma peli, nace un plan
      </p>

      {/* Animation: two avatars + movie + plan badge */}
      <div style={{ position: "relative", height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Left avatar */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "linear-gradient(135deg, #ff3b3b, #cc2020)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, border: "3px solid rgba(255,255,255,0.15)",
          animation: "slideInLeft 0.6s ease-out 0.2s both",
          position: "absolute", left: "15%",
        }}>
          🧑
        </div>

        {/* Center movie icon with glow */}
        <div style={{
          width: 72, height: 72, borderRadius: 16,
          background: "linear-gradient(135deg, #1a1a1a, #111)",
          border: "2px solid rgba(255,59,59,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32,
          animation: "scaleBounce 0.6s ease-out 0.8s both, glowPulse 2s ease-in-out 1.4s infinite",
          position: "relative", zIndex: 2,
        }}>
          🎬
        </div>

        {/* Right avatar */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "linear-gradient(135deg, #25d366, #128C7E)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, border: "3px solid rgba(255,255,255,0.15)",
          animation: "slideInRight 0.6s ease-out 0.2s both",
          position: "absolute", right: "15%",
        }}>
          👩
        </div>

        {/* Connecting lines */}
        <div style={{
          position: "absolute", top: "50%", left: "28%", right: "28%",
          height: 2, background: "linear-gradient(90deg, rgba(255,59,59,0.4), rgba(255,59,59,0.6), rgba(255,59,59,0.4))",
          transform: "translateY(-1px)", zIndex: 1,
          animation: "fadeInUp 0.4s ease-out 0.6s both",
        }} />

        {/* PLAN badge */}
        <div style={{
          position: "absolute", bottom: 10,
          background: "#ff3b3b", borderRadius: 12,
          padding: "8px 20px",
          animation: "scaleBounce 0.5s ease-out 1.6s both",
        }}>
          <span style={{
            fontFamily: "'Archivo Black',sans-serif", fontSize: 18,
            fontWeight: 400, color: "#fff", letterSpacing: "0.05em",
          }}>
            PLAN!
          </span>
        </div>
      </div>

      <p style={{
        margin: "32px 0 0", fontSize: 13, color: "rgba(255,255,255,0.35)",
        lineHeight: 1.6,
      }}>
        Se crea automaticamente. Solo teneis que elegir cuando ir.
      </p>
    </div>
  )
}

/* ═══════════════════════════════════════ */
/* STORY 3: SIN PING PONG                 */
/* ═══════════════════════════════════════ */
function StoryNoPingPong() {
  const chatMessages = [
    { text: "Cuando puedes?", align: "right", delay: 0.3 },
    { text: "No se, tu?", align: "left", delay: 0.8 },
    { text: "El viernes?", align: "right", delay: 1.3 },
    { text: "No puedo...", align: "left", delay: 1.8 },
    { text: "Sabado?", align: "right", delay: 2.3 },
  ]

  return (
    <div style={{ textAlign: "center", width: "100%" }}>
      <h1 style={{
        margin: "0 0 6px", fontFamily: "'Archivo Black',sans-serif",
        fontWeight: 400, fontSize: 34, color: "#fff",
        textTransform: "uppercase", letterSpacing: "-0.02em",
        lineHeight: 1,
      }}>
        <span style={{ display: "block" }}>SIN</span>
        <span style={{ display: "block", color: "#ff3b3b" }}>PING PONG</span>
      </h1>
      <p style={{
        margin: "0 0 28px", fontSize: 14, color: "rgba(255,255,255,0.5)",
        lineHeight: 1.5,
      }}>
        Nada de intercambios infinitos
      </p>

      {/* Chat mockup that gets crossed out → transforms to calendar */}
      <div style={{ position: "relative" }}>
        {/* WhatsApp-style chat bubbles */}
        <div style={{
          position: "relative",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 16, padding: "16px 14px",
          border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}>
          {chatMessages.map((msg, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: msg.align === "right" ? "flex-end" : "flex-start",
              marginBottom: 6,
              animation: `chatBubbleIn 0.3s ease-out ${msg.delay}s both`,
            }}>
              <div style={{
                background: msg.align === "right" ? "rgba(37,211,102,0.15)" : "rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "6px 12px",
                maxWidth: "70%",
              }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{msg.text}</span>
              </div>
            </div>
          ))}

          {/* Strikethrough red line */}
          <div style={{
            position: "absolute", top: "50%", left: 10, right: 10,
            height: 3, background: "#ff3b3b", borderRadius: 2,
            transform: "translateY(-1px) rotate(-3deg)",
            animation: "strikethrough 0.5s ease-out 3s both",
            transformOrigin: "left center",
          }} />

          {/* ❌ emoji */}
          <div style={{
            position: "absolute", top: 8, right: 8,
            fontSize: 24,
            animation: "scaleBounce 0.4s ease-out 3.2s both",
          }}>
            ❌
          </div>
        </div>

        {/* "Cada uno marca..." text — fades out when calendar appears */}
        <p style={{
          margin: "14px 0 0", fontSize: 13, color: "rgba(255,255,255,0.35)",
          lineHeight: 1.6,
          animation: "fadeInUp 0.4s ease-out 0.2s both, fadeOut 0.3s ease-out 3.5s forwards",
        }}>
          Cada uno marca cuando puede y el plan se monta solo.
        </p>

        {/* Calendar result that pops in (replaces the text above) */}
        <div style={{
          marginTop: 8,
          background: "rgba(52,199,89,0.08)",
          border: "1px solid rgba(52,199,89,0.2)",
          borderRadius: 14, padding: "14px 18px",
          animation: "scaleBounce 0.5s ease-out 3.8s both",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 28 }}>📅</span>
          <div style={{ textAlign: "left" }}>
            <p style={{
              margin: 0, fontFamily: "'Archivo Black',sans-serif",
              fontSize: 16, fontWeight: 400, color: "#34c759",
            }}>
              Viernes a las 20:00!
            </p>
            <p style={{
              margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)",
            }}>
              Confirmado automaticamente ✨
            </p>
          </div>
          <span style={{
            fontSize: 22, marginLeft: "auto",
            animation: "confettiPop 0.4s ease-out 4.2s both",
          }}>
            🎉
          </span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════ */
/* STORY 4: VOCITO                        */
/* ═══════════════════════════════════════ */
function StoryVocito({ onConnect, onSkip }) {
  // Phase 2 delays (after Phase 1 fades at 5.3s)
  const waBubbles = [
    { text: "🎬 Ey! Dune 3 en VOSE ya esta en cartelera", delay: 6.5 },
    { text: "🤝 Match! Tu y Guaci quereis ver lo mismo", delay: 7.1 },
    { text: "✅ Plan cerrado. Vie 20:30 Monopol", delay: 7.7 },
  ]

  return (
    <div style={{ textAlign: "center", width: "100%" }}>
      <div style={{ position: "relative", width: "100%" }}>

        {/* ── PHASE 2: CON VOCITO (in flow, defines height) ── */}
        <div style={{ width: "100%" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 22,
            background: "#e8e4df",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
            border: "3px solid rgba(37,211,102,0.3)",
            overflow: "hidden",
            animation: "scaleBounce 0.5s ease-out 5.8s both, glowGreen 2s ease-in-out 6.3s infinite",
          }}>
            <img src="/vocito-avatar.png" alt="VOCITO" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>

          <h2 style={{
            margin: "0 0 16px",
            fontFamily: "'Archivo Black',sans-serif",
            fontWeight: 400, fontSize: 28,
            color: "#fff", textTransform: "uppercase",
            letterSpacing: "0.02em",
            animation: "fadeInUp 0.4s ease-out 6.0s both",
          }}>
            CON VOCITO
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
            {waBubbles.map((b, i) => (
              <div key={i} style={{
                background: "rgba(37,211,102,0.12)",
                border: "1px solid rgba(37,211,102,0.25)",
                borderRadius: 14, borderTopLeftRadius: 4,
                padding: "10px 14px",
                animation: `chatBubbleIn 0.3s ease-out ${b.delay}s both`,
              }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
                  {b.text}
                </span>
              </div>
            ))}
          </div>

          <p style={{
            margin: "16px 0 0", fontSize: 15, fontWeight: 700,
            color: "#25d366",
            animation: "fadeInUp 0.4s ease-out 8.3s both",
          }}>
            Sin abrir la app.
          </p>
        </div>

        {/* ── PHASE 1: THE MISSED NOTIFICATION (absolute overlay) ── */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          animation: "fadeOut 0.5s ease-out 5.3s forwards",
          pointerEvents: "none",
        }}>
          {/* Notification card — looks like a real WhatsApp notification */}
          <div style={{
            width: "100%", borderRadius: 16,
            background: "rgba(37,211,102,0.08)",
            border: "1px solid rgba(37,211,102,0.3)",
            padding: "16px",
            textAlign: "left",
            animation: "chatBubbleIn 0.5s ease-out 0.3s both, goStale 0.8s ease-out 2.0s forwards",
          }}>
            {/* Notification header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: "#e8e4df", overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <img src="/vocito-avatar.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>Vocito</span>
              </div>
              {/* Timestamp that changes from "ahora" to "hace 3 dias" */}
              <span style={{
                fontSize: 11, color: "rgba(37,211,102,0.6)", fontWeight: 500,
                animation: "fadeOut 0.3s ease-out 2.0s forwards",
              }}>
                ahora
              </span>
              <span style={{
                fontSize: 11, color: "rgba(255,59,59,0.5)", fontWeight: 500,
                position: "absolute", right: 16, top: 19,
                animation: "fadeInUp 0.3s ease-out 2.3s both",
              }}>
                hace 3 dias
              </span>
            </div>

            {/* Notification body */}
            <p style={{
              margin: 0, fontSize: 15, color: "rgba(255,255,255,0.8)",
              lineHeight: 1.5, fontWeight: 500,
            }}>
              🎬 Dune 3 en VOSE acaba de llegar a Las Palmas
            </p>
          </div>

          {/* Social FOMO line — appears after notification goes stale */}
          <p style={{
            margin: "20px 0 0", fontSize: 14, color: "rgba(255,255,255,0.35)",
            animation: "fadeInUp 0.4s ease-out 2.8s both",
          }}>
            Guaci ya fue a verla 🍿
          </p>

          {/* Gut punch */}
          <p style={{
            margin: "8px 0 0",
            fontFamily: "'Archivo Black',sans-serif",
            fontSize: 20, fontWeight: 400, color: "rgba(255,255,255,0.2)",
            textTransform: "uppercase", letterSpacing: "0.05em",
            animation: "fadeInUp 0.4s ease-out 3.2s both",
          }}>
            Nadie te aviso.
          </p>
        </div>
      </div>

      {/* ── CTAs ── */}
      <div
        onPointerDown={e => e.stopPropagation()}
        onPointerUp={e => e.stopPropagation()}
        style={{
          display: "flex", flexDirection: "column", gap: 10,
          marginTop: 24,
          animation: "fadeInUp 0.4s ease-out 8.7s both",
        }}
      >
        <button onClick={onConnect} style={{
          width: "100%", padding: "15px 0", borderRadius: 14, border: "none",
          background: "#25d366", color: "#fff", fontSize: 16, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          WebkitTapHighlightColor: "transparent",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#fff"/>
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke="#fff" strokeWidth="1.5" fill="none"/>
          </svg>
          Conectar WhatsApp
        </button>
        <button onClick={onSkip} style={{
          width: "100%", padding: "13px 0", borderRadius: 14,
          background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit",
          WebkitTapHighlightColor: "transparent",
        }}>
          Prefiero enterarme solo
        </button>
      </div>
    </div>
  )
}

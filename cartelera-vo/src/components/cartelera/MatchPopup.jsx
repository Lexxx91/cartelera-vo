import { useState, useEffect } from 'react'
import { sKey } from '../../utils.js'

export default function MatchPopup({ movie, matchedFriends, user, onSelectSession, onDismiss }) {
  const [show, setShow] = useState(false)
  const [selected, setSelected] = useState([]) // array of selected sessions

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 50)
    return () => clearTimeout(t)
  }, [])

  const friend = matchedFriends[0]
  if (!friend) return null

  const myAvatar = user?.user_metadata?.avatar_url
  const friendAvatar = friend.avatar_url
  const myName = user?.user_metadata?.full_name?.split(" ")[0] || "Tu"
  const friendName = friend.nombre_display || friend.nombre || "Amigo"

  // Get sessions from movie.allSessions, filter to next 7 days
  const allSessions = (movie.allSessions || []).filter(s => {
    if (!s.date) return true
    const sessionDate = new Date(s.date + 'T00:00:00')
    const now = new Date()
    const limit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return sessionDate <= limit
  })

  // Group sessions by day → cinema
  const sessionsByDay = {}
  allSessions.forEach(s => {
    const dayKey = s.day || s.date
    if (!sessionsByDay[dayKey]) sessionsByDay[dayKey] = {}
    if (!sessionsByDay[dayKey][s.cinema]) sessionsByDay[dayKey][s.cinema] = []
    sessionsByDay[dayKey][s.cinema].push(s)
  })

  function toggleSession(s) {
    const k = sKey(s)
    setSelected(prev =>
      prev.find(x => sKey(x) === k)
        ? prev.filter(x => sKey(x) !== k)
        : [...prev, s]
    )
  }

  function isSelected(s) {
    return !!selected.find(x => sKey(x) === sKey(s))
  }

  function handleConfirm() {
    if (selected.length === 0) return
    onSelectSession(selected, friend)
  }

  const dayEntries = Object.entries(sessionsByDay)

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.95)",
      display: "flex", flexDirection: "column", alignItems: "center",
      opacity: show ? 1 : 0,
      transition: "opacity 0.4s ease",
      overflowY: "auto",
    }}>
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        width: "100%", maxWidth: 380, padding: "24px 20px",
      }}>
        {/* Poster with glow */}
        <div style={{
          position: "relative", marginBottom: 20, width: 130, height: 185,
          borderRadius: 14, overflow: "hidden", flexShrink: 0,
          boxShadow: "0 0 80px rgba(255,59,59,0.3)",
        }}>
          {movie.poster ? (
            <img src={movie.poster} alt={movie.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(145deg,#1a1a1a,#111)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>
              🎬
            </div>
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)" }} />
        </div>

        {/* Overlapping avatars */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", border: "3px solid #000", overflow: "hidden",
            background: "linear-gradient(135deg,#1a1a1a,#111)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
          }}>
            {myAvatar ? (
              <img src={myAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{myName.charAt(0)}</span>
            )}
          </div>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", border: "3px solid #000", overflow: "hidden",
            background: "linear-gradient(135deg,#1a1a1a,#111)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: -12, zIndex: 1,
          }}>
            {friendAvatar ? (
              <img src={friendAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{friendName.charAt(0)}</span>
            )}
          </div>
        </div>

        {/* Match text */}
        <h2 style={{
          margin: "0 0 6px", fontFamily: "'Archivo Black',sans-serif", fontWeight: 400,
          fontSize: 26, lineHeight: 0.95, textTransform: "uppercase", letterSpacing: "-0.02em",
          textAlign: "center",
        }}>
          <span style={{ WebkitTextStroke: "1.2px #fff", color: "transparent", display: "block" }}>ÑIOS, VAMOS</span>
          <span style={{ color: "#ff3b3b", display: "block" }}>PAL CINE</span>
        </h2>

        <h3 style={{
          margin: "0 0 4px", fontSize: 18, fontWeight: 400, color: "#fff",
          textAlign: "center", fontFamily: "'Archivo Black',sans-serif",
          letterSpacing: "0.02em", textTransform: "uppercase",
        }}>
          {movie.title}
        </h3>

        <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
          {myName} y {friendName} quieren verla
        </p>

        {/* No sessions available */}
        {allSessions.length === 0 && (
          <div style={{
            background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.18)",
            borderRadius: 14, padding: "14px 16px", marginBottom: 20, width: "100%", textAlign: "center",
          }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#ff453a" }}>Sin sesiones disponibles</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Tu voto queda registrado</p>
          </div>
        )}

        {/* Multi-select sessions grid */}
        {allSessions.length > 0 && (
          <>
            <p style={{
              margin: "0 0 14px", fontSize: 11, fontWeight: 700,
              color: "rgba(255,255,255,0.3)", textTransform: "uppercase",
              letterSpacing: "0.1em", textAlign: "center",
            }}>
              Marca cuando puedes ir
            </p>

            <div style={{ width: "100%", marginBottom: 16 }}>
              {dayEntries.map(([day, cinemas]) => (
                <div key={day} style={{ marginBottom: 14 }}>
                  <p style={{
                    margin: "0 0 8px", fontSize: 13, fontWeight: 700,
                    color: "rgba(255,255,255,0.65)",
                  }}>
                    {day}
                  </p>
                  {Object.entries(cinemas).map(([cinema, sessions]) => (
                    <div key={cinema} style={{ marginBottom: 10, paddingLeft: 2 }}>
                      <p style={{
                        margin: "0 0 6px", fontSize: 11,
                        color: "rgba(255,255,255,0.35)",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        📍 {cinema}
                      </p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {sessions.map((s, i) => {
                          const sel = isSelected(s)
                          return (
                            <button
                              key={i}
                              onClick={() => toggleSession(s)}
                              style={{
                                padding: "9px 16px", borderRadius: 11,
                                fontSize: 14, fontWeight: 700,
                                cursor: "pointer", fontFamily: "inherit",
                                transition: "all 0.18s",
                                background: sel ? "rgba(255,59,59,0.15)" : "rgba(255,255,255,0.06)",
                                color: sel ? "#ff3b3b" : "rgba(255,255,255,0.5)",
                                border: sel
                                  ? "1.5px solid rgba(255,59,59,0.4)"
                                  : "1px solid rgba(255,255,255,0.08)",
                                transform: sel ? "scale(1.04)" : "scale(1)",
                              }}
                            >
                              {sel && "✓ "}{s.time}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Confirm button */}
            <button
              onClick={handleConfirm}
              disabled={selected.length === 0}
              style={{
                width: "100%", padding: "16px", borderRadius: 14,
                background: selected.length > 0 ? "#fff" : "rgba(255,255,255,0.07)",
                color: selected.length > 0 ? "#000" : "rgba(255,255,255,0.2)",
                fontSize: 16, fontWeight: 800, cursor: selected.length > 0 ? "pointer" : "not-allowed",
                fontFamily: "inherit", border: "none",
                marginBottom: 12,
                transition: "all 0.2s",
              }}
            >
              {selected.length === 0
                ? "Selecciona al menos una sesion"
                : selected.length === 1
                  ? "Confirmar 1 sesion"
                  : `Confirmar ${selected.length} sesiones`}
            </button>
          </>
        )}

        {/* Close */}
        <button onClick={onDismiss} style={{
          padding: "10px 24px", borderRadius: 8,
          background: "none", color: "rgba(255,255,255,0.3)",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
          fontFamily: "inherit", border: "none",
        }}>
          ✕ Cerrar
        </button>

        {matchedFriends.length > 1 && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
            +{matchedFriends.length - 1} amigo{matchedFriends.length > 2 ? "s" : ""} mas coinciden
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * VocitoSwipeSheet — Bottom-sheet popup that appears after first swipe
 * if WhatsApp is not connected. Persuasive "NO TE ENTERAS" messaging.
 */

export default function VocitoSwipeSheet({ onConnect, onDismiss }) {
  // VOCITO avatar
  const VocitoAvatar = ({ size = 64 }) => (
    <div style={{
      width: size, height: size, borderRadius: size * 0.33,
      background: "#e8e4df",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, border: "2px solid rgba(255,255,255,0.1)",
      overflow: "hidden",
    }}>
      <img
        src="/vocito-avatar.png"
        alt="VOCITO"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  )

  // WhatsApp icon
  const WaIcon = ({ size = 16, color = "#fff" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill={color}/>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke={color} strokeWidth="1.5" fill="none"/>
    </svg>
  )

  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 250,
        background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "vocitoBackdropIn 0.3s ease-out",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 430,
          background: "#1a1a1a",
          borderRadius: "24px 24px 0 0",
          padding: "12px 24px calc(24px + env(safe-area-inset-bottom, 0px))",
          animation: "vocitoSheetSlideUp 0.35s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: "rgba(255,255,255,0.15)",
          margin: "0 auto 20px",
        }} />

        {/* Avatar with float animation */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ display: "inline-block", animation: "vocitoFloat 2.5s ease-in-out infinite" }}>
            <VocitoAvatar size={72} />
          </div>
        </div>

        {/* Title */}
        <h2 style={{
          textAlign: "center", margin: "0 0 8px",
          fontFamily: "'Archivo Black',sans-serif", fontWeight: 400,
          fontSize: 24, letterSpacing: "0.04em",
        }}>
          NO TE <span style={{ color: "#ff3b3b" }}>ENTERAS</span>
        </h2>

        {/* Subtitle */}
        <p style={{
          textAlign: "center", margin: "0 0 20px",
          fontSize: 14, color: "rgba(255,255,255,0.6)",
          lineHeight: 1.6, padding: "0 8px",
        }}>
          Si haces match con alguien y no tienes VOCITO conectado... <strong style={{ color: "#fff" }}>no te vas a enterar!</strong> 😱
        </p>

        {/* Mock notification animation */}
        <div style={{
          position: "relative", overflow: "hidden",
          height: 64, marginBottom: 20, borderRadius: 14,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          {/* Notification that slides in and escapes */}
          <div style={{
            position: "absolute", top: 10, left: 12, right: 12,
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(37,211,102,0.15)",
            border: "1px solid rgba(37,211,102,0.25)",
            borderRadius: 12, padding: "10px 14px",
            animation: "vocitoNotifLoop 3s ease-in-out infinite",
          }}>
            <span style={{ fontSize: 20 }}>🤝</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#25d366" }}>
                Match con Maria!
              </p>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                Los dos quereis ver "Anora" en VOSE
              </p>
            </div>
          </div>

          {/* Red X overlay — "you missed it" */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "vocitoMissedFadeIn 3s ease-in-out infinite",
            pointerEvents: "none",
          }}>
            <span style={{
              fontSize: 28, color: "#ff3b3b", fontWeight: 900,
              textShadow: "0 0 20px rgba(255,59,59,0.5)",
            }}>
              Te lo perdiste 😢
            </span>
          </div>
        </div>

        {/* Feature bullets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
          {[
            { emoji: "🎬", text: "Nuevas pelis VOSE al instante" },
            { emoji: "🤝", text: "Avisos de match con amigos" },
            { emoji: "📅", text: "Gestion de disponibilidad automatica" },
          ].map((f, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 12px",
            }}>
              <span style={{ fontSize: 15 }}>{f.emoji}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{f.text}</span>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={onConnect}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
            background: "#25d366", color: "#fff", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            WebkitTapHighlightColor: "transparent",
            marginBottom: 12,
          }}
        >
          <WaIcon size={16} />
          Conectar WhatsApp
        </button>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          style={{
            width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
            background: "none", color: "rgba(255,255,255,0.3)", fontSize: 13,
            cursor: "pointer", fontFamily: "inherit",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Luego lo miro
        </button>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes vocitoBackdropIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }
        @keyframes vocitoSheetSlideUp {
          from { transform: translateY(100%) }
          to { transform: translateY(0) }
        }
        @keyframes vocitoFloat {
          0%, 100% { transform: translateY(0) }
          50% { transform: translateY(-8px) }
        }
        @keyframes vocitoNotifLoop {
          0% { transform: translateX(-120%); opacity: 0 }
          15% { transform: translateX(0); opacity: 1 }
          55% { transform: translateX(0); opacity: 1 }
          70% { transform: translateX(120%); opacity: 0 }
          100% { transform: translateX(120%); opacity: 0 }
        }
        @keyframes vocitoMissedFadeIn {
          0% { opacity: 0 }
          70% { opacity: 0 }
          80% { opacity: 1 }
          95% { opacity: 1 }
          100% { opacity: 0 }
        }
      `}</style>
    </div>
  )
}

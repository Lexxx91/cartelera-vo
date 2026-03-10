export default function VocitoCard({ isLinked, waLinking, waLinkError, onConnect, onUnlink, onRetry, compact = false }) {
  // VOCITO avatar component
  const VocitoAvatar = ({ size = 48 }) => (
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

  // WhatsApp SVG icon (small, for buttons)
  const WaIcon = ({ size = 16, color = "#fff" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill={color}/>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke={color} strokeWidth="1.5" fill="none"/>
    </svg>
  )

  /* ─── COMPACT MODE (for AmigosTab) ─── */
  if (compact) {
    if (isLinked) return null // Don't show compact card if already linked

    return (
      <div style={{
        background: "rgba(37,211,102,0.06)",
        border: "1px solid rgba(37,211,102,0.12)",
        borderRadius: 16, padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <VocitoAvatar size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 400, color: "#fff", fontFamily: "'Archivo Black',sans-serif" }}>
            VOCITO
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            Tu asistente de cine en WhatsApp
          </p>
        </div>
        <button onClick={onConnect} style={{
          padding: "8px 14px", borderRadius: 10, border: "none",
          background: "#25d366", color: "#fff", fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
          WebkitTapHighlightColor: "transparent",
        }}>
          Conectar
        </button>
      </div>
    )
  }

  /* ─── FULL MODE (for ProfileTab) ─── */

  // State: Already linked
  if (isLinked) {
    return (
      <div style={{ padding: "0 20px", marginBottom: 20 }}>
        <div style={{
          background: "rgba(37,211,102,0.06)",
          border: "1px solid rgba(37,211,102,0.15)",
          borderRadius: 20, padding: "16px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <VocitoAvatar size={36} />
            <div>
              <span style={{ fontSize: 14, fontWeight: 400, color: "#fff", fontFamily: "'Archivo Black',sans-serif" }}>
                VOCITO
              </span>
              <span style={{ fontSize: 11, color: "rgba(37,211,102,0.7)", marginLeft: 8 }}>conectado ✓</span>
            </div>
          </div>
          <button onClick={onUnlink} style={{
            background: "none", border: "none", cursor: "pointer", padding: 6,
            color: "rgba(255,255,255,0.2)", fontSize: 11, fontFamily: "inherit",
          }}>
            Desvincular
          </button>
        </div>
      </div>
    )
  }

  // State: Linking timed out
  if (waLinkError === 'timeout') {
    return (
      <div style={{ padding: "0 20px", marginBottom: 20 }}>
        <div style={{
          background: "rgba(255,59,59,0.06)",
          border: "1px solid rgba(255,59,59,0.2)",
          borderRadius: 20, padding: "24px 18px",
          textAlign: "center",
        }}>
          <VocitoAvatar size={56} />
          <p style={{ margin: "14px 0 6px", fontSize: 15, fontWeight: 600, color: "#ff3b3b" }}>
            VOCITO no ha respondido
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
            Puede que el servicio este temporalmente no disponible.
            <br />Intentalo de nuevo mas tarde.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onRetry} style={{
              flex: 1, padding: "12px 0", borderRadius: 12, border: "none",
              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              Reintentar
            </button>
            <button onClick={onConnect} style={{
              flex: 1, padding: "12px 0", borderRadius: 12, border: "none",
              background: "#25d366", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              Reenviar mensaje
            </button>
          </div>
        </div>
      </div>
    )
  }

  // State: Linking in progress
  if (waLinking) {
    return (
      <div style={{ padding: "0 20px", marginBottom: 20 }}>
        <div style={{
          background: "rgba(37,211,102,0.06)",
          border: "1px solid rgba(37,211,102,0.2)",
          borderRadius: 20, padding: "24px 18px",
          textAlign: "center",
        }}>
          <VocitoAvatar size={56} />
          <div style={{
            width: 24, height: 24, margin: "12px auto 0",
            border: "2.5px solid rgba(37,211,102,0.3)",
            borderTop: "2.5px solid #25d366",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }} />
          <p style={{ margin: "14px 0 6px", fontSize: 15, fontWeight: 600, color: "#fff" }}>
            {waLinkError === 'slow' ? 'Aun esperando...' : 'Esperando mensaje...'}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
            {waLinkError === 'slow'
              ? <>VOCITO esta tardando en responder.<br />Asegurate de haber enviado el mensaje.</>
              : <>Envia el mensaje en WhatsApp y vuelve aqui.<br />Se vinculara automaticamente.</>
            }
          </p>
        </div>
      </div>
    )
  }

  // State: Not linked — the compelling sell
  return (
    <div style={{ padding: "0 20px", marginBottom: 20 }}>
      <div style={{
        background: "rgba(37,211,102,0.06)",
        border: "1px solid rgba(37,211,102,0.12)",
        borderRadius: 20, padding: "24px 20px",
      }}>
        {/* Header: Avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <VocitoAvatar size={52} />
          <div>
            <h3 style={{
              margin: 0, fontFamily: "'Archivo Black',sans-serif", fontWeight: 400,
              fontSize: 18, color: "#fff", letterSpacing: "0.02em",
            }}>
              VOCITO
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
              Tu asistente de cine en WhatsApp
            </p>
          </div>
        </div>

        {/* Value proposition */}
        <p style={{
          margin: "0 0 16px", fontSize: 13, color: "rgba(255,255,255,0.55)",
          lineHeight: 1.6,
        }}>
          Te aviso en tiempo real de nuevas pelis en VOSE en Las Palmas, cuando hagas match con un amigo, y gestiono tu disponibilidad por ti.
        </p>

        {/* Feature bullets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
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
        <button onClick={onConnect} style={{
          width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
          background: "#25d366", color: "#fff", fontSize: 15, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          WebkitTapHighlightColor: "transparent",
          transition: "opacity 0.2s",
        }}>
          <WaIcon size={16} />
          Conectar WhatsApp
        </button>
      </div>
    </div>
  )
}

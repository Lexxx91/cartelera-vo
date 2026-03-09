import { useState, useEffect } from 'react'

const DISMISS_KEY = 'vose_install_dismissed'
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

/**
 * Banner flotante de instalación PWA.
 * Aparece una vez en la primera visita móvil. Si se dismissea, no vuelve en 7 días.
 */
export default function InstallBanner({ canInstall, isIOS, isIOSChrome, isInstalled, onPromptInstall, onGoToProfile }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Don't show if already installed or no mobile platform detected
    if (isInstalled || (!canInstall && !isIOS && !isIOSChrome)) {
      setVisible(false)
      return
    }

    // Check 7-day cooldown
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed) {
      const elapsed = Date.now() - parseInt(dismissed, 10)
      if (elapsed < SEVEN_DAYS) {
        setVisible(false)
        return
      }
    }

    // Show after a 2s delay to not interrupt page load
    const timer = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(timer)
  }, [isInstalled, canInstall, isIOS, isIOSChrome])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  function handleInstall() {
    if (canInstall) {
      onPromptInstall?.()
    } else {
      // iOS (Safari or Chrome) → go to profile where instructions are shown
      onGoToProfile?.()
    }
    dismiss()
  }

  // Different banner text for iOS Chrome
  const bannerText = isIOSChrome ? "Abre en Safari para instalar" : "Para una mejor experiencia"
  const buttonText = isIOSChrome ? "Ver como" : "Instalar"

  if (!visible) return null

  return (
    <>
      <style>{`
        @keyframes voseBannerIn {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <div style={{
        position: "fixed",
        bottom: "calc(56px + env(safe-area-inset-bottom, 0px) + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: 398,
        zIndex: 150,
        animation: "voseBannerIn 0.4s ease forwards",
      }}>
        <div style={{
          background: "rgba(24,24,28,0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 18,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>
          {/* Mini VOSE logo */}
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#000",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: 10,
              fontWeight: 400,
              letterSpacing: "0.02em",
            }}>
              <span style={{ color: "#fff" }}>VO</span>
              <span style={{ color: "#ff3b3b" }}>SE</span>
            </span>
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
            }}>Instala VOSE</p>
            <p style={{
              margin: "2px 0 0",
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
            }}>{bannerText}</p>
          </div>

          {/* Install button */}
          <button onClick={handleInstall} style={{
            padding: "8px 16px",
            borderRadius: 10,
            border: "none",
            background: "#ff3b3b",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            flexShrink: 0,
            WebkitTapHighlightColor: "transparent",
          }}>
            {buttonText}
          </button>

          {/* Dismiss */}
          <button onClick={dismiss} style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "rgba(255,255,255,0.3)",
            fontSize: 16,
            flexShrink: 0,
            lineHeight: 1,
            WebkitTapHighlightColor: "transparent",
          }}>
            ✕
          </button>
        </div>
      </div>
    </>
  )
}

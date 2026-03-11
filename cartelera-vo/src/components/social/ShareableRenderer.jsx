import { useRef, useCallback } from 'react'

/**
 * ShareableRenderer — Wraps a card for Instagram Story export (1080×1920).
 * Uses html2canvas to capture the card as PNG, then Web Share API or download.
 */
export default function ShareableRenderer({ children, onShareStart, onShareEnd }) {
  const cardRef = useRef(null)

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return
    onShareStart?.()

    try {
      // Dynamic import to avoid loading html2canvas until needed
      const { default: html2canvas } = await import('html2canvas')

      const canvas = await html2canvas(cardRef.current, {
        width: 1080,
        height: 1920,
        scale: 1,
        backgroundColor: '#000000',
        useCORS: true,
        logging: false,
      })

      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], 'vose.png', { type: 'image/png' })

        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'VOSE' })
          } catch {
            // User cancelled share — not an error
          }
        } else {
          // Fallback: download
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'vose.png'
          a.click()
          URL.revokeObjectURL(url)
        }
        onShareEnd?.()
      }, 'image/png')
    } catch (err) {
      console.error('ShareableRenderer error:', err)
      onShareEnd?.()
    }
  }, [onShareStart, onShareEnd])

  return { cardRef, handleShare }
}

/**
 * ShareButton — Consistent share button used on all cards.
 */
export function ShareButton({ onClick, label = "Compartir" }) {
  return (
    <button onClick={onClick} style={{
      display:"flex",alignItems:"center",justifyContent:"center",gap:8,
      width:"100%",padding:"14px 24px",borderRadius:14,
      background:"rgba(255,59,59,0.12)",border:"1px solid rgba(255,59,59,0.25)",
      color:"#ff3b3b",fontSize:13,fontWeight:700,cursor:"pointer",
      fontFamily:"inherit",WebkitTapHighlightColor:"transparent",
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="#ff3b3b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {label}
    </button>
  )
}

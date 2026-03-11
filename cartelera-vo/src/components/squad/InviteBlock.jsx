import { useState, useEffect, useRef } from 'react'

export default function InviteBlock({ inviteCode, hasFriends, onShare, onEnterCode }) {
  const [copied, setCopied] = useState(false)
  const [typedCode, setTypedCode] = useState('')
  const typeTimer = useRef(null)

  // Typewriter effect for empty state
  useEffect(() => {
    if (hasFriends || !inviteCode) return
    let i = 0
    setTypedCode('')
    typeTimer.current = setInterval(() => {
      i++
      setTypedCode(inviteCode.slice(0, i))
      if (i >= inviteCode.length) clearInterval(typeTimer.current)
    }, 80)
    return () => clearInterval(typeTimer.current)
  }, [inviteCode, hasFriends])

  const url = `https://cartelera-vo.vercel.app?code=${inviteCode}`

  function handleCopy() {
    navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: 'VOSE',
        text: '¿Vamos pal cine? Con VOSE haces swipe en la cartelera de VO de Las Palmas y cuando coincides con un amigo se monta el plan solo.',
        url,
      }).catch(() => {})
    } else {
      handleCopy()
    }
  }

  if (!inviteCode) return null

  // Compact version when user has friends
  if (hasFriends) {
    return (
      <div style={{padding:"0 20px",marginBottom:16}}>
        <div style={{
          display:"flex",alignItems:"center",gap:12,
          background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:14,padding:"12px 16px",
        }}>
          <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:14,color:"#fff",letterSpacing:"0.06em"}}>{inviteCode}</span>
          <div style={{flex:1}} />
          <button onClick={handleCopy} style={{
            padding:"6px 12px",borderRadius:8,
            background: copied ? "rgba(52,199,89,0.15)" : "rgba(255,255,255,0.06)",
            border: copied ? "1px solid rgba(52,199,89,0.3)" : "1px solid rgba(255,255,255,0.1)",
            color: copied ? "#34c759" : "rgba(255,255,255,0.5)",
            fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            transition:"all 0.3s ease",
          }}>
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button onClick={handleShare} style={{
            padding:"6px 12px",borderRadius:8,
            background:"rgba(255,59,59,0.1)",border:"1px solid rgba(255,59,59,0.2)",
            color:"#ff3b3b",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
          }}>
            Compartir
          </button>
        </div>
      </div>
    )
  }

  // Full empty state with animations
  return (
    <div style={{padding:"0 20px",marginBottom:20}}>
      <div style={{
        textAlign:"center",padding:"32px 24px 28px",
        background:"linear-gradient(135deg, rgba(255,59,59,0.06) 0%, rgba(0,0,0,0.3) 100%)",
        border:"1px solid rgba(255,59,59,0.15)",borderRadius:20,
        animation:"fadeIn 0.6s ease",
      }}>
        <p style={{fontSize:48,margin:"0 0 14px",animation:"inviteBounce 0.6s ease"}}>😬</p>
        <h3 style={{
          margin:"0 0 8px",fontFamily:"'Archivo Black',sans-serif",fontWeight:400,
          fontSize:16,color:"#fff",lineHeight:1.3,
        }}>
          Solo como las palomitas
        </h3>
        <p style={{
          color:"rgba(255,255,255,0.35)",fontSize:12,margin:"0 auto 24px",lineHeight:1.7,maxWidth:240,
        }}>
          Esto se hizo para ir al cine con tu gente, no solo como un baifo perdido.
        </p>

        {/* Code display */}
        <div style={{
          display:"inline-block",padding:"14px 28px",borderRadius:14,
          background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",
          marginBottom:20,position:"relative",overflow:"hidden",
        }}>
          <p style={{margin:"0 0 4px",fontSize:9,fontWeight:600,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.08em"}}>
            Tu código de invitación
          </p>
          <p style={{
            margin:0,fontFamily:"'Archivo Black',sans-serif",fontSize:24,color:"#fff",
            letterSpacing:"0.1em",minHeight:32,
          }}>
            {typedCode}
            {typedCode.length < inviteCode.length && (
              <span style={{animation:"blink 1s step-end infinite",color:"#ff3b3b"}}>|</span>
            )}
          </p>
          {/* Shimmer dots */}
          <div style={{display:"flex",justifyContent:"center",gap:4,marginTop:8}}>
            {Array.from({length:7}).map((_,i) => (
              <span key={i} style={{
                width:4,height:4,borderRadius:"50%",
                background:"rgba(255,59,59,0.4)",
                animation:`shimmer 2s ease-in-out ${i*0.15}s infinite`,
              }} />
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
          <button onClick={handleCopy} style={{
            padding:"12px 24px",borderRadius:14,width:"80%",
            background: copied ? "rgba(52,199,89,0.15)" : "rgba(255,255,255,0.06)",
            border: copied ? "1px solid rgba(52,199,89,0.3)" : "1px solid rgba(255,255,255,0.1)",
            color: copied ? "#34c759" : "rgba(255,255,255,0.6)",
            fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            transition:"all 0.3s ease",
          }}>
            {copied ? "Copiado, chacho" : "Copiar enlace"}
          </button>
          <button onClick={handleShare} style={{
            padding:"12px 24px",borderRadius:14,width:"80%",
            background:"rgba(255,59,59,0.12)",border:"1px solid rgba(255,59,59,0.25)",
            color:"#ff3b3b",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
          }}>
            Mandar por WhatsApp
          </button>
        </div>

        {/* Enter code section */}
        {onEnterCode && (
          <>
            <div style={{display:"flex",alignItems:"center",gap:12,margin:"20px auto 16px",maxWidth:180}}>
              <div style={{flex:1,height:1,background:"rgba(255,255,255,0.08)"}} />
              <span style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}>o</span>
              <div style={{flex:1,height:1,background:"rgba(255,255,255,0.08)"}} />
            </div>
            <p style={{margin:"0 0 10px",fontSize:12,color:"rgba(255,255,255,0.35)"}}>
              ¿Te han dado un código?
            </p>
            <button onClick={onEnterCode} style={{
              padding:"10px 20px",borderRadius:12,
              background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
              color:"rgba(255,255,255,0.5)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
            }}>
              Meter código de un bro
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes inviteBounce {
          0% { transform: translateY(-20px); opacity: 0; }
          60% { transform: translateY(5px); }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

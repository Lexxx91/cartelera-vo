import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

export default function Login({ onDemoMode }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [posters, setPosters] = useState([])

  // ?code= deep link is now handled in App.jsx (before Login even mounts)

  // Fetch real movie posters on mount
  useEffect(() => {
    async function fetchPosters() {
      try {
        const { data } = await supabase
          .from('cartelera')
          .select('poster, title')
          .not('poster', 'is', null)
          .limit(24)

        if (data && data.length > 0) {
          const unique = [...new Set(data.map(m => m.poster).filter(Boolean))]
          setPosters(unique.slice(0, 21))
        }
      } catch (e) {
        console.warn('Login posters fetch failed:', e)
      }
    }
    fetchPosters()
  }, [])

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  // Split posters into three rows
  const third = Math.ceil(posters.length / 3)
  const row1 = posters.slice(0, third)
  const row2 = posters.slice(third, third * 2)
  const row3 = posters.slice(third * 2)

  return (
    <div style={{
      height: '100vh', position: 'relative',
      background: '#000', fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#fff', overflow: 'hidden',
    }}>

      {/* Poster Marquee (background) */}
      {posters.length > 0 && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          overflow: 'hidden',
          opacity: 0.4, paddingTop: 20,
          animation: 'fadeIn 1.2s ease',
        }}>
          <MarqueeRow posters={row1} direction="left" duration={35} />
          <MarqueeRow posters={row2} direction="right" duration={42} />
          <MarqueeRow posters={row3} direction="left" duration={38} />

          {/* Gradient overlays */}
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 60, background: 'linear-gradient(to right, #000, transparent)', zIndex: 2, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 60, background: 'linear-gradient(to left, #000, transparent)', zIndex: 2, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, #000, transparent)', zIndex: 2, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 50, background: 'linear-gradient(to bottom, #000 20%, transparent)', zIndex: 2, pointerEvents: 'none' }} />
        </div>
      )}

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 10,
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingLeft: 32, paddingRight: 32,
      }}>

        {/* Hero headline */}
        <div style={{
          animation: 'fadeInUp 0.7s ease both 0.15s',
          textAlign: 'center',
        }}>
          <p style={{
            margin: 0,
            fontFamily: "'Archivo Black', sans-serif",
            fontWeight: 400,
            fontSize: 52, lineHeight: 0.95,
            letterSpacing: '-0.02em',
            WebkitTextStroke: '1.5px #fff',
            color: 'transparent',
          }}>
            ¿VAMOS
          </p>
          <p style={{
            margin: '2px 0',
            fontFamily: "'Archivo Black', sans-serif",
            fontWeight: 400,
            fontSize: 52, lineHeight: 0.95,
            letterSpacing: '-0.02em',
            color: '#ff3b3b',
            WebkitTextStroke: 'none',
          }}>
            PAL CINE
          </p>
          <p style={{
            margin: 0,
            fontFamily: "'Archivo Black', sans-serif",
            fontWeight: 400,
            fontSize: 52, lineHeight: 0.95,
            letterSpacing: '-0.02em',
            WebkitTextStroke: '1.5px #fff',
            color: 'transparent',
          }}>
            O QUÉ?
          </p>
        </div>

        {/* Google Login Button — always enabled */}
        <div style={{
          width: '100%', maxWidth: 280, marginTop: 32,
          animation: 'fadeInUp 0.7s ease both 0.45s',
        }}>
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 14,
              border: 'none',
              background: '#ff3b3b',
              color: '#fff',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15, fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10,
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 15, height: 15,
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  display: 'inline-block', animation: 'spin 0.7s linear infinite',
                }} />
                Redirigiendo...
              </>
            ) : (
              <>
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Entrar con Google
              </>
            )}
          </button>

          {/* Error message */}
          {error && (
            <p style={{ color: '#ff3b3b', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{error}</p>
          )}
        </div>

        {/* Demo mode */}
        <button
          onClick={onDemoMode}
          style={{
            background: 'none', border: 'none', padding: 0,
            color: 'rgba(255,255,255,0.15)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            letterSpacing: '0.01em',
            marginTop: 28,
            animation: 'fadeInUp 0.7s ease both 0.6s',
          }}
        >
          Probar sin cuenta
        </button>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes marqueeLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marqueeRight {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

function MarqueeRow({ posters, direction, duration }) {
  if (posters.length === 0) return null
  let set = [...posters]
  while (set.length < 7) { set = [...set, ...posters] }
  const all = [...set, ...set]
  const animName = direction === 'left' ? 'marqueeLeft' : 'marqueeRight'

  return (
    <div style={{ overflow: 'hidden', width: '100%', marginBottom: 8 }}>
      <div style={{
        display: 'flex', gap: 8,
        width: 'fit-content',
        animation: `${animName} ${duration}s linear infinite`,
      }}>
        {all.map((url, i) => (
          <PosterCard key={`${direction}-${i}`} url={url} />
        ))}
      </div>
    </div>
  )
}

function PosterCard({ url }) {
  const [failed, setFailed] = useState(false)
  return (
    <div style={{
      width: 72, height: 106, borderRadius: 8, overflow: 'hidden',
      flexShrink: 0,
      background: failed ? 'linear-gradient(145deg, #1a1a1a, #111)' : '#111',
    }}>
      {!failed && (
        <img src={url} alt="" onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />
      )}
    </div>
  )
}

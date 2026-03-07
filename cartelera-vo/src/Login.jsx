import { useState } from 'react'
import { supabase } from './supabase.js'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function loginWithGoogle() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24,
      background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(201,168,76,0.07) 0%, transparent 70%)'
    }}>
      <div style={{
        background: '#0d0d12', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 28, padding: '48px 40px', maxWidth: 400, width: '100%',
        textAlign: 'center', position: 'relative'
      }}>
        {/* Top gold line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(to right, transparent, #c9a84c, transparent)',
          borderRadius: '28px 28px 0 0'
        }} />

        <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>

        <h1 style={{
          fontFamily: 'Bebas Neue, sans-serif', fontSize: 36,
          letterSpacing: '0.06em', color: '#f5f3ef', marginBottom: 8
        }}>CARTELERA VO</h1>

        <p style={{
          fontSize: 14, color: 'rgba(255,255,255,0.4)',
          lineHeight: 1.6, marginBottom: 36
        }}>
          Toda la cartelera en versión original<br />
          de Las Palmas de Gran Canaria
        </p>

        <button
          onClick={loginWithGoogle}
          disabled={loading}
          style={{
            width: '100%', padding: '15px 24px', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.12)',
            background: loading ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)',
            color: '#fff', fontFamily: 'DM Sans, sans-serif',
            fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, transition: 'all 0.2s'
          }}
        >
          {loading ? (
            <span style={{
              width: 18, height: 18, border: '2px solid rgba(255,255,255,0.15)',
              borderTopColor: '#fff', borderRadius: '50%',
              display: 'inline-block', animation: 'spin 0.7s linear infinite'
            }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading ? 'Redirigiendo...' : 'Continuar con Google'}
        </button>

        {error && (
          <p style={{ color: '#e8473f', fontSize: 13, marginTop: 16 }}>{error}</p>
        )}

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 24, lineHeight: 1.6 }}>
          Al continuar aceptas que tus datos se guardan<br />para personalizar tu experiencia cinéfila.
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

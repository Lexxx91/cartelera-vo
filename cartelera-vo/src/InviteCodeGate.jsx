import { useState } from 'react'
import { supabase } from './supabase.js'

export default function InviteCodeGate({ user, onCodeValidated, onLogout }) {
  const [code, setCode] = useState('')
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState(null)
  const [shaking, setShaking] = useState(false)

  async function handleValidate() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) { setError('Mete un codigo, illo'); return }

    setValidating(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase
        .rpc('validate_invite_code', { p_code: trimmed })

      if (rpcError) { setError('Sin cobertura, bro. Reintenta.'); setValidating(false); return }
      if (!data) {
        setError('Ese codigo no cuela 🤷')
        setShaking(true)
        setTimeout(() => setShaking(false), 500)
        setValidating(false)
        return
      }

      // Code valid — save and notify parent
      localStorage.setItem('vose_invite_code', trimmed)
      onCodeValidated(trimmed)
    } catch {
      setError('Algo fallo. Dale otra vez.')
      setValidating(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#000',
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#fff', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 32px',
    }}>
      {/* Hero headline — branding canario */}
      <div style={{
        textAlign: 'center', marginBottom: 8,
        animation: 'fadeInUp 0.6s ease both',
      }}>
        <p style={{
          margin: 0,
          fontFamily: "'Archivo Black', sans-serif",
          fontWeight: 400,
          fontSize: 38, lineHeight: 0.95,
          letterSpacing: '-0.02em',
          WebkitTextStroke: '1.5px #fff',
          color: 'transparent',
        }}>
          ESPERA,
        </p>
        <p style={{
          margin: '2px 0',
          fontFamily: "'Archivo Black', sans-serif",
          fontWeight: 400,
          fontSize: 38, lineHeight: 0.95,
          letterSpacing: '-0.02em',
          color: '#ff3b3b',
        }}>
          CHACHO
        </p>
      </div>

      {/* User info */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 28, animation: 'fadeIn 0.5s ease both 0.2s',
      }}>
        {user?.user_metadata?.avatar_url && (
          <img src={user.user_metadata.avatar_url} alt=""
            style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        )}
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          {user?.user_metadata?.full_name || user?.email}
        </span>
      </div>

      {/* Gate card */}
      <div style={{
        width: '100%', maxWidth: 300,
        animation: 'fadeInUp 0.5s ease both 0.15s',
      }}>
        <p style={{
          margin: '0 0 6px', fontSize: 15, fontWeight: 600,
          color: 'rgba(255,255,255,0.7)', textAlign: 'center',
        }}>
          Esto es solo pa los elegidos 🎬
        </p>
        <p style={{
          margin: '0 0 20px', fontSize: 13,
          color: 'rgba(255,255,255,0.3)', textAlign: 'center',
          lineHeight: 1.5,
        }}>
          Pega el codigo que te paso tu compadre y ya estas dentro.
        </p>

        {/* Code input */}
        <input
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setError(null) }}
          onKeyDown={e => e.key === 'Enter' && handleValidate()}
          placeholder="XXXXXX"
          autoCapitalize="characters"
          autoComplete="off"
          autoFocus
          style={{
            width: '100%', padding: '14px 0', borderRadius: 0,
            border: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent',
            color: '#fff', fontFamily: "'DM Sans', sans-serif",
            fontSize: 18, fontWeight: 400, letterSpacing: '0.2em',
            textAlign: 'center', boxSizing: 'border-box',
            outline: 'none', transition: 'all 0.3s',
            animation: shaking ? 'shake 0.4s ease' : 'none',
          }}
        />

        {/* Validate button */}
        <button
          onClick={handleValidate}
          disabled={validating || !code.trim()}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 14,
            border: 'none', marginTop: 16,
            background: code.trim() ? '#ff3b3b' : 'rgba(255,255,255,0.04)',
            color: code.trim() ? '#fff' : 'rgba(255,255,255,0.15)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15, fontWeight: 600,
            cursor: code.trim() && !validating ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10,
            transition: 'all 0.3s',
          }}
        >
          {validating ? (
            <>
              <span style={{
                width: 15, height: 15,
                border: '2px solid rgba(255,255,255,0.2)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block', animation: 'spin 0.7s linear infinite',
              }} />
              Verificando...
            </>
          ) : (
            'Vamos pa dentro'
          )}
        </button>

        {/* Error */}
        {error && (
          <p style={{
            color: '#ff3b3b', fontSize: 13, marginTop: 12,
            textAlign: 'center', animation: 'fadeIn 0.2s ease',
          }}>
            {error}
          </p>
        )}

        {/* Logout link */}
        <button
          onClick={onLogout}
          style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.15)',
            fontSize: 12, cursor: 'pointer', marginTop: 24,
            fontFamily: "'DM Sans', sans-serif", width: '100%',
            textAlign: 'center',
          }}
        >
          No soy yo, cambia de cuenta
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }
        input::placeholder { color: rgba(255,255,255,0.15); font-weight: 300; }
        input:focus { border-bottom-color: rgba(255,255,255,0.35) !important; }
      `}</style>
    </div>
  )
}

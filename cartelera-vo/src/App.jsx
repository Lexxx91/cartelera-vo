import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import Login from './Login.jsx'
import InviteCodeGate from './InviteCodeGate.jsx'
import CarteleraApp from './CarteleraApp.jsx'

// Mock user for demo mode (no Google login needed)
const DEMO_USER = {
  id: 'demo-local-user',
  email: 'demo@carteleravo.app',
  user_metadata: { full_name: 'Tú', avatar_url: null },
  isDemo: true,
}

export default function App() {
  const [session, setSession] = useState(undefined)       // undefined = loading
  const [demoMode, setDemoMode] = useState(false)
  const [pendingPlanJoin, setPendingPlanJoin] = useState(null)
  // 'loading' | 'exists' | 'needs_code' | 'ready_to_create'
  const [gate, setGate] = useState('loading')

  // ── Deep links: ?plan=XXX and ?code=XXX ──────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    // Plan deep link
    const planId = params.get('plan')
    if (planId) setPendingPlanJoin(planId)

    // Invite code deep link — save BEFORE Google redirect so it's available after
    // Guard: only treat as invite code if short alphanumeric (not a long OAuth PKCE code)
    const urlCode = params.get('code')
    const isInviteCode = urlCode && /^[A-Z0-9]{4,12}$/i.test(urlCode.trim())
    if (isInviteCode) localStorage.setItem('vose_invite_code', urlCode.trim().toUpperCase())

    // Clean URL params (but NOT if it's an OAuth code — let Supabase handle it)
    if (planId || isInviteCode) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // ── Auth listener ────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      // Reset gate when session changes (login/logout)
      if (!session) setGate('loading')
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── After session obtained: check if profile exists ──────────────
  useEffect(() => {
    if (!session) return

    ;(async () => {
      setGate('loading')

      const { data, error } = await supabase
        .from("perfiles")
        .select("id")
        .eq("id", session.user.id)
        .maybeSingle()

      if (error) {
        console.error('Profile check error:', error)
        // On error, still try to proceed — useProfile will handle creation
        setGate('exists')
        return
      }

      if (data) {
        // ✅ Returning user (any browser) — profile exists in DB
        localStorage.setItem('vose_has_account', 'true')
        setGate('exists')
      } else {
        // New user — check if they already have an invite code
        const storedCode = localStorage.getItem('vose_invite_code')
        if (storedCode) {
          // Has code from URL (?code=XXX) or previous InviteCodeGate entry
          // → useProfile will create the profile with this code
          setGate('ready_to_create')
        } else {
          // No profile, no code → must enter invite code first
          setGate('needs_code')
        }
      }
    })()
  }, [session])

  // ── Demo mode ────────────────────────────────────────────────────
  if (demoMode) {
    return (
      <CarteleraApp
        user={DEMO_USER}
        onLogout={() => setDemoMode(false)}
        pendingPlanJoin={pendingPlanJoin}
        onClearPendingPlan={() => setPendingPlanJoin(null)}
      />
    )
  }

  // ── Loading session ──────────────────────────────────────────────
  if (session === undefined) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#000',
      }}>
        <div style={{
          width: 32, height: 32,
          border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── No session → Login screen ────────────────────────────────────
  if (!session) {
    return <Login onDemoMode={() => setDemoMode(true)} />
  }

  // ── Session exists but checking profile ──────────────────────────
  if (gate === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#000',
      }}>
        <div style={{
          width: 32, height: 32,
          border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── No profile + no invite code → InviteCodeGate ─────────────────
  if (gate === 'needs_code') {
    return (
      <InviteCodeGate
        user={session.user}
        onCodeValidated={() => {
          // Code is now validated and saved in localStorage by InviteCodeGate
          // → flip gate to let CarteleraApp mount → useProfile creates profile
          setGate('ready_to_create')
        }}
        onLogout={() => supabase.auth.signOut()}
      />
    )
  }

  // ── Profile exists OR code ready → CarteleraApp ──────────────────
  return (
    <CarteleraApp
      user={session.user}
      onLogout={() => supabase.auth.signOut()}
      pendingPlanJoin={pendingPlanJoin}
      onClearPendingPlan={() => setPendingPlanJoin(null)}
    />
  )
}

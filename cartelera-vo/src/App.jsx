import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import Login from './Login.jsx'
import CarteleraApp from './CarteleraApp.jsx'

// Mock user for demo mode (no Google login needed)
const DEMO_USER = {
  id: 'demo-local-user',
  email: 'demo@carteleravo.app',
  user_metadata: { full_name: 'Tú', avatar_url: null },
  isDemo: true,
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [demoMode, setDemoMode] = useState(false)
  const [pendingPlanJoin, setPendingPlanJoin] = useState(null)

  // Read ?plan=PLAN_ID from URL for deep linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const planId = params.get('plan')
    if (planId) {
      setPendingPlanJoin(planId)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Demo mode — skip auth entirely
  if (demoMode) {
    return <CarteleraApp user={DEMO_USER} onLogout={() => setDemoMode(false)} pendingPlanJoin={pendingPlanJoin} onClearPendingPlan={() => setPendingPlanJoin(null)} />
  }

  // Loading
  if (session === undefined) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#000'
      }}>
        <div style={{
          width: 32, height: 32,
          border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!session) return <Login onDemoMode={() => setDemoMode(true)} />

  return <CarteleraApp user={session.user} onLogout={() => supabase.auth.signOut()} pendingPlanJoin={pendingPlanJoin} onClearPendingPlan={() => setPendingPlanJoin(null)} />
}

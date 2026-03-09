import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'

// Hooks
import useProfile from './hooks/useProfile.js'
import useFriends from './hooks/useFriends.js'
import useVotes from './hooks/useVotes.js'
import usePlans from './hooks/usePlans.js'
import useMovies from './hooks/useMovies.js'
import useDemo, { DEMO_FRIEND } from './hooks/useDemo.js'

// Components
import Toast from './components/Toast.jsx'
import BottomNav from './components/BottomNav.jsx'
import CartelleraTab from './components/cartelera/CartelleraTab.jsx'
import MatchPopup from './components/cartelera/MatchPopup.jsx'
import AmigosTab from './components/amigos/AmigosTab.jsx'
import ProfileTab from './components/perfil/ProfileTab.jsx'

export default function CarteleraApp({ user, onLogout }) {
  const [tab, setTab] = useState("cartelera")
  const [toasts, setToasts] = useState([])
  const [matchPopup, setMatchPopup] = useState(null)
  const [openPlans, setOpenPlans] = useState([])
  const [localVotes, setLocalVotes] = useState({}) // local votes for demo mode

  // Initialize hooks
  const { profile, loading: profileLoading, updateProfile, uploadAvatar, inviteeCount } = useProfile(user)
  const { friends: realFriends, pendingIn, pendingOut, acceptRequest, removeFriend, getFriendsOfFriend, sendDirectRequest, discoverUsers } = useFriends(user)
  const realVotes = useVotes(user, realFriends)
  const realPlans = usePlans(user, realFriends)
  const { movies, loading: moviesLoading, error: moviesError } = useMovies()

  // Demo mode: only active when using "Probar sin cuenta" (not for real Google users)
  const demo = useDemo(movies)
  const isDemoMode = user?.isDemo === true
  const friends = isDemoMode ? [DEMO_FRIEND] : realFriends
  const myVotes = isDemoMode ? localVotes : realVotes.myVotes
  const friendVotes = isDemoMode ? demo.getDemoFriendVotes() : realVotes.friendVotes
  const plans = isDemoMode ? demo.demoPlans : realPlans.plans
  const getMyState = isDemoMode ? demo.getMyState : realPlans.getMyState

  // Load fonts
  useEffect(() => {
    const link = document.createElement("link")
    link.rel = "preconnect"
    link.href = "https://fonts.googleapis.com"
    document.head.appendChild(link)
    const link2 = document.createElement("link")
    link2.rel = "stylesheet"
    link2.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Serif+Display&display=swap"
    document.head.appendChild(link2)
  }, [])

  // Toast helper
  function addToast(t) {
    const id = Date.now()
    setToasts(ts => [...ts, { ...t, id }])
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 4000)
  }

  // Fetch open plans from friends periodically (real mode only)
  useEffect(() => {
    if (isDemoMode || realFriends.length === 0) return
    const fetchOpen = async () => {
      const op = await realPlans.getOpenPlans()
      setOpenPlans(op)
    }
    fetchOpen()
    const interval = setInterval(fetchOpen, 5000)
    return () => clearInterval(interval)
  }, [isDemoMode, realFriends, realPlans.getOpenPlans])

  // Handle swipe vote
  async function handleSwipe(movie, direction) {
    if (isDemoMode) {
      // Demo: local votes only
      setLocalVotes(prev => ({ ...prev, [movie.title]: direction }))
      if (direction === 'voy') {
        addToast({ type: "vote", emoji: "🎟️", title: "Voto registrado", body: `"${movie.title}"` })
        const matchResult = demo.checkDemoMatch(movie.title)
        if (matchResult) {
          setMatchPopup({ movie, matchedFriends: matchResult })
        }
      }
    } else {
      // Real: write to Supabase
      const result = await realVotes.vote(movie.title, direction)
      if (direction === 'voy') {
        addToast({ type: "vote", emoji: "🎟️", title: "Voto registrado", body: `"${movie.title}"` })
        if (result && result.length > 0) {
          setMatchPopup({ movie, matchedFriends: result })
        }
      }
    }
  }

  // Handle match → create plan directly with selected session
  async function handleMatchSelectSession(session, friend) {
    if (!matchPopup) return
    let plan
    if (isDemoMode) {
      plan = await demo.createDemoPlan(matchPopup.movie.title, user?.id || "local-user", session)
    } else {
      plan = await realPlans.createPlan(matchPopup.movie.title, friend.id, session)
    }
    setMatchPopup(null)
    if (plan) {
      addToast({ type: "match", emoji: "🎯", title: "Plan creado", body: `${friend.nombre_display || friend.nombre} sera notificado` })
      setTab("amigos")

      // Send email notification to partner (fire-and-forget, don't block UI)
      if (!isDemoMode) {
        const myName = profile?.nombre_display || profile?.nombre || "Alguien"
        supabase.functions.invoke("notify-match", {
          body: {
            partnerId: friend.id,
            movieTitle: matchPopup.movie.title,
            initiatorName: myName,
          },
        }).catch(err => console.warn("Email notification failed (non-blocking):", err))
      }
    } else {
      addToast({ type: "error", emoji: "❌", title: "Error", body: "No se pudo crear el plan" })
    }
  }

  // Handle inline VOY from Amigos tab — same flow as swiping VOY on a card
  async function handleVoyInline(movieTitle) {
    const movie = movies.find(m => m.title === movieTitle)
    if (isDemoMode) {
      setLocalVotes(prev => ({ ...prev, [movieTitle]: 'voy' }))
      addToast({ type: "vote", emoji: "🎟️", title: "VOY", body: `"${movieTitle}"` })
      const matchResult = demo.checkDemoMatch(movieTitle)
      if (matchResult && movie) {
        setMatchPopup({ movie, matchedFriends: matchResult })
      }
    } else {
      const result = await realVotes.vote(movieTitle, 'voy')
      addToast({ type: "vote", emoji: "🎟️", title: "VOY", body: `"${movieTitle}"` })
      if (result && result.length > 0 && movie) {
        setMatchPopup({ movie, matchedFriends: result })
      }
    }
  }

  // Plan actions — route to demo or real
  function handleRespondYes(planId) {
    if (isDemoMode) demo.respondYes(planId)
    else realPlans.respondYes(planId)
  }
  function handleRespondNo(planId) {
    if (isDemoMode) demo.respondNo(planId)
    else realPlans.respondNo(planId)
  }
  function handleSendAvailability(planId, sessions) {
    if (isDemoMode) demo.sendAvailability(planId, sessions)
    else realPlans.sendAvailability(planId, sessions)
  }
  function handlePickSession(planId, session) {
    if (isDemoMode) demo.pickSession(planId, session)
    else realPlans.pickSession(planId, session)
  }
  function handleRejectAll(planId) {
    if (isDemoMode) demo.rejectAll(planId)
    else realPlans.rejectAll(planId)
  }

  // Handle direct friend request (from friends-of-friends discovery or social feed)
  async function handleSendDirectRequest(targetId) {
    if (isDemoMode) {
      addToast({ type: "friend", emoji: "👋", title: "Solicitud enviada", body: "Modo demo" })
      return { success: true, name: "Demo" }
    }
    const result = await sendDirectRequest(targetId)
    if (result.success) {
      addToast({ type: "friend", emoji: "👋", title: "Solicitud enviada", body: `A ${result.name}` })
    }
    return result
  }

  // Handle accept friend
  async function handleAcceptFriend(friendshipId) {
    await acceptRequest(friendshipId)
    addToast({ type: "friend", emoji: "🤝", title: "Amigo aceptado", body: "Ya podeis ver coincidencias" })
  }

  // Handle join plan
  async function handleJoinPlan(planId) {
    if (isDemoMode) {
      demo.joinDemoOpenPlan(planId, user?.id || "demo-local-user")
    } else {
      await realPlans.joinPlan(planId)
    }
    addToast({ type: "join", emoji: "🎉", title: "Te has apuntado", body: "Ya estas en el plan" })
  }

  // Mark movie as watched with rating + optional plan context
  function handleMarkWatched(movieTitle, rating, planContext) {
    const entry = {
      title: movieTitle,
      rating,
      date: new Date().toISOString().split('T')[0],
      ...(planContext?.cinema && { cinema: planContext.cinema }),
      ...(planContext?.time && { time: planContext.time }),
      ...(planContext?.with && planContext.with.length > 0 && { with: planContext.with }),
    }
    const currentWatched = profile?.watched || []
    // Avoid duplicates
    if (currentWatched.some(w => w.title === movieTitle)) return
    const updated = [...currentWatched, entry]
    updateProfile({ watched: updated })
    addToast({ type: "watched", emoji: "🍿", title: "Marcada como vista", body: `${movieTitle} — ${"★".repeat(rating)}` })
  }

  // Save payer (roulette result)
  function handleSavePayer(planId, payerName) {
    if (isDemoMode) demo.savePayer(planId, payerName)
    else realPlans.savePayer(planId, payerName)
  }

  // Friend suggestions
  const friendSuggestions = isDemoMode ? demo.getDemoSuggestions(localVotes) : realVotes.getFriendSuggestions()

  // Badge count
  const badgeCount = pendingIn.length + plans.filter(p => {
    const s = getMyState(p)
    return s === 'proposed' || s === 'pick_avail' || s === 'pick_theirs'
  }).length

  // Loading
  if (profileLoading) {
    return (
      <div style={{minHeight:"100vh",background:"#09090b",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:24,height:24,border:"2px solid rgba(255,255,255,0.1)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{minHeight:"100vh",background:"#000",fontFamily:"'DM Sans',-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif",color:"#fff",overflowX:"hidden",maxWidth:430,margin:"0 auto",position:"relative"}}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{display:none}
        *{box-sizing:border-box}
        input::placeholder{color:rgba(255,255,255,0.26)}
        input:focus{outline:none}
      `}</style>

      <Toast toasts={toasts} />

      {/* Match popup overlay */}
      {matchPopup && (
        <MatchPopup
          movie={matchPopup.movie}
          matchedFriends={matchPopup.matchedFriends}
          user={user}
          onSelectSession={handleMatchSelectSession}
          onDismiss={() => setMatchPopup(null)}
        />
      )}

      {/* Tab content */}
      <div style={{paddingBottom:70,height:"100vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {tab === "cartelera" && (
          <CartelleraTab
            movies={movies}
            loading={moviesLoading}
            error={moviesError}
            myVotes={myVotes}
            friendVotes={friendVotes}
            onSwipe={handleSwipe}
            user={user}
          />
        )}
        {tab === "amigos" && (
          <AmigosTab
            user={user}
            friends={friends}
            pendingIn={pendingIn}
            pendingOut={pendingOut}
            onAcceptFriend={handleAcceptFriend}
            onRemoveFriend={removeFriend}
            plans={plans}
            getMyState={getMyState}
            onRespondYes={handleRespondYes}
            onRespondNo={handleRespondNo}
            onSendAvailability={handleSendAvailability}
            onPickSession={handlePickSession}
            onRejectAll={handleRejectAll}
            openPlans={isDemoMode ? demo.demoOpenPlans : openPlans}
            onJoinPlan={handleJoinPlan}
            friendSuggestions={friendSuggestions}
            onVoyInline={handleVoyInline}
            onSwitchToCartelera={() => setTab("cartelera")}
            isDemoMode={isDemoMode}
            movies={movies}
            onGetFriendsOfFriend={isDemoMode ? demo.getDemoFriendsOfFriend : getFriendsOfFriend}
            onSendDirectRequest={handleSendDirectRequest}
            friendVotes={friendVotes}
            myVotesForCommon={myVotes}
            getDemoMoviesInCommon={isDemoMode ? demo.getDemoMoviesInCommon : null}
            onDiscoverUsers={isDemoMode ? demo.getDemoDiscoverUsers : discoverUsers}
            onMarkWatched={handleMarkWatched}
            onSavePayer={handleSavePayer}
          />
        )}
        {tab === "perfil" && (
          <ProfileTab
            user={user}
            profile={profile}
            onUpdateProfile={updateProfile}
            onUploadAvatar={uploadAvatar}
            onLogout={onLogout}
            myVotes={myVotes}
            movies={movies}
            inviteeCount={inviteeCount}
          />
        )}
      </div>

      <BottomNav tab={tab} onTabChange={setTab} badge={badgeCount} />
    </div>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { getAllSessionsForMovie, findNearestSession, sKey } from '../utils.js'

// ─── Demo friends ─────────────────────────────────────────────────────────────
export const DEMO_FRIEND = {
  id: "demo-carlos",
  friendshipId: "demo-friendship-1",
  nombre: "Carlos",
  nombre_display: "Carlos",
  avatar_url: null,
  email: null,
  invite_code: "GOFIO42",
  isDemo: true,
}

export const DEMO_FRIEND_LUCIA = {
  id: "demo-lucia",
  friendshipId: "demo-friendship-2",
  nombre: "Lucía",
  nombre_display: "Lucía",
  avatar_url: null,
  email: null,
  invite_code: "TIMPLE77",
  isDemo: true,
}

// Friends-of-friends for demo (Carlos's other friends)
export const DEMO_FOF_ANA = {
  id: "demo-ana",
  nombre: "Ana",
  nombre_display: "Ana García",
  avatar_url: null,
  isDemo: true,
}

export const DEMO_FOF_MARCOS = {
  id: "demo-marcos",
  nombre: "Marcos",
  nombre_display: "Marcos López",
  avatar_url: null,
  isDemo: true,
}

// Discoverable users for social feed (Instagram-like)
export const DEMO_DISCOVER_USERS = [
  { id: "demo-elena", nombre: "Elena", nombre_display: "Elena Ruiz", avatar_url: null, invited_by_name: "Carlos", isDemo: true },
  { id: "demo-pablo", nombre: "Pablo", nombre_display: "Pablo Hernández", avatar_url: null, invited_by_name: "Lucía", isDemo: true },
  { id: "demo-maria", nombre: "María", nombre_display: "María Torres", avatar_url: null, invited_by_name: null, isDemo: true },
  { id: "demo-david", nombre: "David", nombre_display: "David Navarro", avatar_url: null, invited_by_name: "Elena Ruiz", isDemo: true },
  { id: "demo-sofia", nombre: "Sofía", nombre_display: "Sofía Vega", avatar_url: null, invited_by_name: "Carlos", isDemo: true },
]

// Seed to consistently pick which movies Carlos "likes"
function hashTitle(title) {
  let h = 0
  for (let i = 0; i < title.length; i++) {
    h = ((h << 5) - h) + title.charCodeAt(i)
    h = h & h
  }
  return Math.abs(h)
}

// Carlos votes VOY on ~50% of movies (deterministic based on title)
export function carlosWantsToSee(movieTitle) {
  return hashTitle(movieTitle) % 3 !== 0 // ~66% chance, more interesting for demo
}

// ─── useDemo hook ──────────────────────────────────────────────────────────────
export default function useDemo(movies) {
  const [demoPlans, setDemoPlans] = useState([])
  const [demoOpenPlans, setDemoOpenPlans] = useState([])
  const openPlanCreated = useRef(false)
  const planIdCounter = useRef(1)

  // Create a pre-existing open plan between Carlos & Lucía once movies load
  useEffect(() => {
    if (openPlanCreated.current || movies.length === 0) return
    openPlanCreated.current = true

    // Pick a movie that Carlos wants to see (for consistency)
    const candidate = movies.find(m => carlosWantsToSee(m.title))
    if (!candidate) return

    ;(async () => {
      const sessions = await getAllSessionsForMovie(candidate.title)
      const session = findNearestSession(sessions)
      if (!session) return

      setDemoOpenPlans([{
        id: 'demo-open-plan-1',
        movie_title: candidate.title,
        state: 'confirmed',
        initiator_id: DEMO_FRIEND.id,
        partner_id: DEMO_FRIEND_LUCIA.id,
        chosen_session: session,
        participants: [DEMO_FRIEND.id, DEMO_FRIEND_LUCIA.id],
        participantProfiles: [
          { id: DEMO_FRIEND.id, nombre: DEMO_FRIEND.nombre, nombre_display: DEMO_FRIEND.nombre_display },
          { id: DEMO_FRIEND_LUCIA.id, nombre: DEMO_FRIEND_LUCIA.nombre, nombre_display: DEMO_FRIEND_LUCIA.nombre_display },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isDemo: true,
      }])
    })()
  }, [movies])

  // Join a demo open plan (move from openPlans → user's confirmed plans)
  function joinDemoOpenPlan(planId, userId) {
    const plan = demoOpenPlans.find(p => p.id === planId)
    if (!plan) return

    // Remove from open plans
    setDemoOpenPlans(prev => prev.filter(p => p.id !== planId))

    // Add to user's plans as confirmed
    setDemoPlans(prev => [...prev, {
      ...plan,
      participants: [...plan.participants, userId],
      partner: DEMO_FRIEND,
      amIInitiator: false,
      initiator_response: 'yes',
      partner_response: 'yes',
      proposed_session: plan.chosen_session,
      initiator_availability: [],
      partner_availability: [],
      first_no_user: null,
    }])
  }

  // Get demo voters for a movie title
  const getDemoVoters = useCallback((movieTitle) => {
    if (carlosWantsToSee(movieTitle)) {
      return [{
        userId: DEMO_FRIEND.id,
        name: DEMO_FRIEND.nombre,
        avatar_url: DEMO_FRIEND.avatar_url,
      }]
    }
    return []
  }, [])

  // Build friendVotes map from movies (what Carlos "voted")
  const getDemoFriendVotes = useCallback(() => {
    const fv = {}
    movies.forEach(m => {
      if (carlosWantsToSee(m.title)) {
        fv[m.title] = [{
          userId: DEMO_FRIEND.id,
          name: DEMO_FRIEND.nombre,
          avatar_url: DEMO_FRIEND.avatar_url,
        }]
      }
    })
    return fv
  }, [movies])

  // Check if Carlos matches on a movie
  const checkDemoMatch = useCallback((movieTitle) => {
    if (carlosWantsToSee(movieTitle)) {
      // Check if a demo plan already exists for this movie
      const existing = demoPlans.find(p => p.movie_title === movieTitle && p.state !== 'no_match')
      if (existing) return null
      return [DEMO_FRIEND]
    }
    return null
  }, [demoPlans])

  // Create a demo plan (local state, no Supabase)
  // sessions is an array of selected sessions from MatchPopup
  async function createDemoPlan(movieTitle, userId, sessions) {
    // Normalize: accept single session (legacy) or array
    let sessionList = Array.isArray(sessions) ? sessions : sessions ? [sessions] : null
    if (!sessionList || sessionList.length === 0) {
      const fetched = await getAllSessionsForMovie(movieTitle)
      const nearest = findNearestSession(fetched)
      if (!nearest) return null
      sessionList = [nearest]
    }

    const plan = {
      id: `demo-plan-${planIdCounter.current++}`,
      movie_title: movieTitle,
      state: 'proposed',
      initiator_id: userId,
      partner_id: DEMO_FRIEND.id,
      proposed_session: sessionList[0], // best/nearest for display
      initiator_response: 'yes', // initiator confirmed availability
      partner_response: null,
      initiator_availability: sessionList, // ALL selected sessions
      partner_availability: [],
      chosen_session: null,
      participants: [userId, DEMO_FRIEND.id],
      first_no_user: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Enriched
      partner: DEMO_FRIEND,
      amIInitiator: true,
      isDemo: true,
    }

    setDemoPlans(prev => [...prev, plan])

    // Simulate Carlos picking a session from the availability after 2-3s
    setTimeout(() => {
      setDemoPlans(prev => prev.map(p => {
        if (p.id !== plan.id) return p
        // Carlos picks a random session from the list (or first if only 1)
        const pick = sessionList.length > 1
          ? sessionList[Math.floor(Math.random() * sessionList.length)]
          : sessionList[0]
        return {
          ...p,
          partner_response: 'yes',
          state: 'confirmed',
          chosen_session: pick,
          updated_at: new Date().toISOString(),
        }
      }))
    }, 2000 + Math.random() * 1000)

    return plan
  }

  // Get "my state" for a demo plan
  // Note: in demo, user is always the initiator (amIInitiator = true)
  function getMyState(plan) {
    if (plan.state === 'confirmed') return 'confirmed'
    if (plan.state === 'no_match') return 'no_match'

    const myResponse = plan.initiator_response
    const theirResponse = plan.partner_response
    const theirAvail = plan.partner_availability

    // NEW FLOW: If the other person has sent availability and I haven't responded → pick from theirs
    if (!myResponse && theirAvail && theirAvail.length > 0) {
      return 'pick_theirs'
    }

    if (!myResponse && !theirResponse) return 'proposed'

    // I said yes — waiting for them
    if (myResponse === 'yes') {
      if (theirResponse === 'yes') return 'confirmed'
      if (theirAvail && theirAvail.length > 0) return 'pick_theirs'
      return 'waiting_them'
    }

    // I said no (legacy fallback)
    if (myResponse === 'no') {
      if (!plan.initiator_availability || plan.initiator_availability.length === 0) return 'pick_avail'
      if (plan.chosen_session) return 'confirmed'
      return 'waiting_pick'
    }
    return 'proposed'
  }

  // Respond YES
  function respondYes(planId) {
    setDemoPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const updated = { ...p, initiator_response: 'yes', updated_at: new Date().toISOString() }
      // Simulate Carlos responding YES after 2-3s
      setTimeout(() => {
        setDemoPlans(prev2 => prev2.map(p2 => {
          if (p2.id !== planId) return p2
          return {
            ...p2,
            partner_response: 'yes',
            state: 'confirmed',
            chosen_session: p2.proposed_session,
            updated_at: new Date().toISOString(),
          }
        }))
      }, 2000 + Math.random() * 1000)
      return updated
    }))
  }

  // Respond NO
  function respondNo(planId) {
    setDemoPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      return {
        ...p,
        initiator_response: 'no',
        first_no_user: p.first_no_user || p.initiator_id,
        updated_at: new Date().toISOString(),
      }
    }))
  }

  // Send availability
  function sendAvailability(planId, sessions) {
    setDemoPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const updated = { ...p, initiator_availability: sessions, updated_at: new Date().toISOString() }

      // Simulate Carlos picking the first session after 2-3s
      setTimeout(() => {
        setDemoPlans(prev2 => prev2.map(p2 => {
          if (p2.id !== planId) return p2
          return {
            ...p2,
            chosen_session: sessions[0],
            state: 'confirmed',
            updated_at: new Date().toISOString(),
          }
        }))
      }, 2000 + Math.random() * 1000)

      return updated
    }))
  }

  // Pick from Carlos's availability
  function pickSession(planId, session) {
    setDemoPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      return {
        ...p,
        chosen_session: session,
        state: 'confirmed',
        updated_at: new Date().toISOString(),
      }
    }))
  }

  // Save payer (roulette result)
  function savePayer(planId, payerName) {
    setDemoPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      return { ...p, payer_name: payerName, updated_at: new Date().toISOString() }
    }))
  }

  // Save user's rating for a demo plan
  function saveDemoRating(planId, userId, rating) {
    setDemoPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const ratings = { ...(p.ratings || {}), [userId]: { rating, date: new Date().toISOString().split('T')[0] } }
      return { ...p, ratings, updated_at: new Date().toISOString() }
    }))
  }

  // Reject all → no_match
  function rejectAll(planId) {
    setDemoPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      return { ...p, state: 'no_match', updated_at: new Date().toISOString() }
    }))
  }

  // Get friend suggestions (movies Carlos likes that I haven't voted on)
  function getDemoSuggestions(myVotes) {
    const suggestions = []
    movies.forEach(m => {
      if (carlosWantsToSee(m.title) && !myVotes[m.title]) {
        suggestions.push({
          movieTitle: m.title,
          voters: [{
            userId: DEMO_FRIEND.id,
            name: DEMO_FRIEND.nombre,
            avatar_url: DEMO_FRIEND.avatar_url,
          }],
        })
      }
    })
    return suggestions
  }

  // Get simulated friends-of-friends for a demo friend
  function getDemoFriendsOfFriend(friendId) {
    if (friendId === DEMO_FRIEND.id) {
      return [DEMO_FRIEND_LUCIA, DEMO_FOF_ANA, DEMO_FOF_MARCOS]
    }
    return []
  }

  // Get discoverable demo users (for social feed) — returns Promise for consistency
  async function getDemoDiscoverUsers() {
    return DEMO_DISCOVER_USERS
  }

  // Get movies both user and a demo friend voted "voy"
  function getDemoMoviesInCommon(friendId, localVotes) {
    if (friendId !== DEMO_FRIEND.id) return []
    const common = []
    movies.forEach(m => {
      if (localVotes[m.title] === 'voy' && carlosWantsToSee(m.title)) {
        common.push(m)
      }
    })
    return common
  }

  return {
    isDemoMode: true,
    demoFriend: DEMO_FRIEND,
    demoPlans,
    demoOpenPlans,
    getDemoVoters,
    getDemoFriendVotes,
    checkDemoMatch,
    createDemoPlan,
    joinDemoOpenPlan,
    getMyState,
    respondYes,
    respondNo,
    sendAvailability,
    pickSession,
    rejectAll,
    savePayer,
    saveDemoRating,
    getDemoSuggestions,
    getDemoFriendsOfFriend,
    getDemoMoviesInCommon,
    getDemoDiscoverUsers,
  }
}

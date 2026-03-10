import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase.js'
import { getAllSessionsForMovie, findNearestSession } from '../utils.js'

export default function usePlans(user, friends, { onPlanStateChange } = {}) {
  const [plans, setPlans] = useState([])   // all plans I'm involved in
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)

  const fetchingRef = useRef(false)
  const prevPlansRef = useRef([])

  const fetchPlans = useCallback(async () => {
    if (!user || fetchingRef.current) return
    // Demo mode — no Supabase, plans managed locally in useDemo
    if (user.isDemo) { setLoading(false); return }

    fetchingRef.current = true
    try {
      const { data: rows } = await supabase
        .from("planes")
        .select("*")
        .or(`initiator_id.eq.${user.id},partner_id.eq.${user.id},participants.cs.{${user.id}}`)
        .order("updated_at", { ascending: false })

      if (rows) {
        // Enrich with friend profile data
        const enriched = rows.map(plan => {
          const partnerId = plan.initiator_id === user.id ? plan.partner_id : plan.initiator_id
          const partner = friends.find(f => f.id === partnerId) || { id: partnerId, nombre: "Amigo" }
          const amIInitiator = plan.initiator_id === user.id
          return { ...plan, partner, amIInitiator }
        })
        // Detect state transitions for notifications
        if (onPlanStateChange && prevPlansRef.current.length > 0) {
          enriched.forEach(plan => {
            const prev = prevPlansRef.current.find(p => p.id === plan.id)
            if (prev) {
              const prevState = getMyState(prev)
              const newState = getMyState(plan)
              if (prevState !== newState && newState) {
                onPlanStateChange(plan, prevState, newState)
              }
            }
          })
        }
        prevPlansRef.current = enriched
        setPlans(enriched)
      }

      setLoading(false)
    } finally {
      fetchingRef.current = false
    }
  }, [user, friends])

  useEffect(() => {
    fetchPlans()
    const startPolling = () => { pollRef.current = setInterval(fetchPlans, 5000) }
    const stopPolling = () => clearInterval(pollRef.current)
    const handleVisibility = () => {
      if (document.hidden) stopPolling()
      else { fetchPlans(); startPolling() }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    startPolling()
    return () => { stopPolling(); document.removeEventListener('visibilitychange', handleVisibility) }
  }, [fetchPlans])

  // Create a new plan after match detection
  // sessions is an array of selected sessions from MatchPopup
  async function createPlan(movieTitle, partnerId, sessions) {
    if (!user) return null

    // Normalize: accept single session (legacy) or array
    let sessionList = Array.isArray(sessions) ? sessions : sessions ? [sessions] : null
    if (!sessionList || sessionList.length === 0) {
      // Fallback: fetch sessions if not provided
      const fetched = await getAllSessionsForMovie(movieTitle)
      const nearest = findNearestSession(fetched)
      if (!nearest) return null
      sessionList = [nearest]
    }

    const plan = {
      movie_title: movieTitle,
      state: 'proposed',
      initiator_id: user.id,
      partner_id: partnerId,
      proposed_session: sessionList[0], // best/nearest for display
      initiator_availability: sessionList, // ALL selected sessions
      initiator_response: 'yes', // initiator confirmed availability
      participants: [user.id, partnerId],
    }

    const { data, error } = await supabase
      .from("planes")
      .insert(plan)
      .select()
      .single()

    if (error) {
      console.error("Create plan error:", error)
      return null
    }

    await fetchPlans()
    return data
  }

  // Get my view state for a plan
  function getMyState(plan) {
    if (!user || !plan) return null
    const amIInitiator = plan.initiator_id === user.id
    const myResponse = amIInitiator ? plan.initiator_response : plan.partner_response
    const theirResponse = amIInitiator ? plan.partner_response : plan.initiator_response
    const theirAvail = amIInitiator ? plan.partner_availability : plan.initiator_availability

    // Terminal states
    if (plan.state === 'confirmed') return 'confirmed'
    if (plan.state === 'no_match') return 'no_match'

    // NEW FLOW: If the other person has sent availability and I haven't responded → pick from theirs
    if (!myResponse && theirAvail && theirAvail.length > 0) {
      return 'pick_theirs'
    }

    // I haven't responded, they haven't sent availability
    if (!myResponse && !theirResponse) return 'proposed'
    if (!myResponse && theirResponse === 'yes') return 'proposed'
    if (!myResponse && theirResponse === 'no') return 'proposed'

    // I said yes — waiting for them
    if (myResponse === 'yes') {
      if (theirResponse === 'yes') return 'confirmed'
      if (theirAvail && theirAvail.length > 0) return 'pick_theirs'
      return 'waiting_them'
    }

    // I said no (legacy flow fallback)
    if (myResponse === 'no') {
      const myAvail = amIInitiator ? plan.initiator_availability : plan.partner_availability
      if (!myAvail || myAvail.length === 0) return 'pick_avail'
      if (plan.chosen_session) return 'confirmed'
      return 'waiting_pick'
    }

    return 'proposed'
  }

  // Respond YES to the proposed session
  async function respondYes(planId) {
    const plan = plans.find(p => p.id === planId)
    if (!plan || plan.state === 'confirmed' || plan.state === 'no_match') return

    const amIInitiator = plan.initiator_id === user.id
    const responseField = amIInitiator ? 'initiator_response' : 'partner_response'
    const theirResponse = amIInitiator ? plan.partner_response : plan.initiator_response

    const update = { [responseField]: 'yes' }

    // If both said yes, confirm!
    if (theirResponse === 'yes') {
      update.state = 'confirmed'
      update.chosen_session = plan.proposed_session
    }

    await supabase.from("planes").update(update).eq("id", planId)
    await fetchPlans()
  }

  // Respond NO to the proposed session
  async function respondNo(planId) {
    const plan = plans.find(p => p.id === planId)
    if (!plan || plan.state === 'confirmed' || plan.state === 'no_match') return

    const amIInitiator = plan.initiator_id === user.id
    const responseField = amIInitiator ? 'initiator_response' : 'partner_response'

    const update = { [responseField]: 'no' }

    // Track who said NO first (for Case D: both say NO)
    if (!plan.first_no_user) {
      update.first_no_user = user.id
    }

    await supabase.from("planes").update(update).eq("id", planId)
    await fetchPlans()
  }

  // Send my availability (list of sessions I can attend)
  async function sendAvailability(planId, sessions) {
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) return
    const plan = plans.find(p => p.id === planId)
    if (!plan) return

    const amIInitiator = plan.initiator_id === user.id
    const availField = amIInitiator ? 'initiator_availability' : 'partner_availability'

    const { error } = await supabase.from("planes").update({
      [availField]: sessions,
    }).eq("id", planId)
    if (error) console.error("sendAvailability error:", error)
    await fetchPlans()
  }

  // Pick a session from partner's availability
  async function pickSession(planId, session) {
    const plan = plans.find(p => p.id === planId)
    if (!plan || plan.state === 'confirmed') return
    await supabase.from("planes").update({
      chosen_session: session,
      state: 'confirmed',
    }).eq("id", planId)
    await fetchPlans()
  }

  // Reject all sessions → no_match
  async function rejectAll(planId) {
    const plan = plans.find(p => p.id === planId)
    if (!plan || plan.state === 'confirmed' || plan.state === 'no_match') return
    await supabase.from("planes").update({
      state: 'no_match',
    }).eq("id", planId)
    await fetchPlans()
  }

  // Join an existing confirmed plan
  async function joinPlan(planId) {
    const plan = plans.find(p => p.id === planId)
    if (!plan) {
      const { data } = await supabase
        .from("planes")
        .select("*")
        .eq("id", planId)
        .single()
      if (data) {
        if ((data.participants || []).includes(user.id)) return
        const participants = [...(data.participants || []), user.id]
        await supabase.from("planes").update({ participants }).eq("id", planId)
        await fetchPlans()
        return
      }
      return
    }

    if ((plan.participants || []).includes(user.id)) return
    const participants = [...(plan.participants || []), user.id]
    await supabase.from("planes").update({ participants }).eq("id", planId)
    await fetchPlans()
  }

  // Leave a plan
  async function leavePlan(planId) {
    const plan = plans.find(p => p.id === planId)
    if (!plan) return

    const participants = (plan.participants || []).filter(id => id !== user.id)
    await supabase.from("planes").update({ participants }).eq("id", planId)
    await fetchPlans()
  }

  // Save who pays (roulette result)
  async function savePayer(planId, payerName) {
    await supabase.from("planes").update({ payer_name: payerName }).eq("id", planId)
    await fetchPlans()
  }

  // Save user's rating for a plan
  async function saveRating(planId, rating) {
    const plan = plans.find(p => p.id === planId)
    if (!plan || !user) return
    const ratings = { ...(plan.ratings || {}), [user.id]: { rating, date: new Date().toISOString().split('T')[0] } }
    await supabase.from("planes").update({ ratings }).eq("id", planId)
    await fetchPlans()
  }

  // Get confirmed plans from friends that I can join
  async function getOpenPlans() {
    if (!user || !friends || friends.length === 0) return []
    const friendIds = friends.map(f => f.id)

    const { data: rows } = await supabase
      .from("planes")
      .select("*")
      .eq("state", "confirmed")
      .not("participants", "cs", `{${user.id}}`)

    if (!rows) return []

    return rows.filter(plan => {
      const session = plan.chosen_session
      if (session?.date && session?.time) {
        const [year, month, day] = session.date.split("-").map(Number)
        const [hours, minutes] = (session.time || "00:00").split(":").map(Number)
        if (year) {
          const target = new Date(year, month - 1, day, (hours || 0) + 2, minutes || 0)
          if (Date.now() > target.getTime()) return false
        }
      }
      return (plan.participants || []).some(pid => friendIds.includes(pid))
    }).map(plan => {
      const participantProfiles = (plan.participants || []).map(pid => {
        const friend = friends.find(f => f.id === pid)
        return friend || { id: pid, nombre: "Alguien" }
      })
      return { ...plan, participantProfiles }
    })
  }

  return {
    plans,
    loading,
    createPlan,
    getMyState,
    respondYes,
    respondNo,
    sendAvailability,
    pickSession,
    rejectAll,
    joinPlan,
    leavePlan,
    getOpenPlans,
    savePayer,
    saveRating,
    refresh: fetchPlans,
  }
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase.js'

export default function useVotes(user, friends) {
  const [myVotes, setMyVotes] = useState({})          // { movieTitle: 'voy' | 'paso' }
  const [friendVotes, setFriendVotes] = useState({})   // { movieTitle: [{ userId, name, avatar_url }] }
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)

  const fetchVotes = useCallback(async () => {
    if (!user) return
    // Demo mode — no Supabase, votes managed locally in CarteleraApp
    if (user.isDemo) { setLoading(false); return }

    // Get my votes
    const { data: myRows } = await supabase
      .from("votos")
      .select("movie_title, vote")
      .eq("user_id", user.id)

    const myV = {}
    if (myRows) {
      myRows.forEach(r => { myV[r.movie_title] = r.vote })
    }
    setMyVotes(myV)

    // Get friend votes (only 'voy')
    const friendIds = (friends || []).map(f => f.id)
    if (friendIds.length > 0) {
      const { data: friendRows } = await supabase
        .from("votos")
        .select("user_id, movie_title, vote")
        .in("user_id", friendIds)
        .eq("vote", "voy")

      const fv = {}
      if (friendRows) {
        friendRows.forEach(r => {
          if (!fv[r.movie_title]) fv[r.movie_title] = []
          const friend = friends.find(f => f.id === r.user_id)
          if (friend) {
            fv[r.movie_title].push({
              userId: r.user_id,
              name: friend.nombre_display || friend.nombre || "Amigo",
              avatar_url: friend.avatar_url,
            })
          }
        })
      }
      setFriendVotes(fv)
    } else {
      setFriendVotes({})
    }

    setLoading(false)
  }, [user, friends])

  useEffect(() => {
    fetchVotes()
    pollRef.current = setInterval(fetchVotes, 4000)
    return () => clearInterval(pollRef.current)
  }, [fetchVotes])

  // Cast a vote (voy or paso)
  async function vote(movieTitle, voteType) {
    if (!user) return null

    // Upsert vote
    const { error } = await supabase
      .from("votos")
      .upsert({
        user_id: user.id,
        movie_title: movieTitle,
        vote: voteType,
      }, { onConflict: 'user_id,movie_title' })

    if (error) {
      console.error("Vote error:", error)
      return null
    }

    setMyVotes(prev => ({ ...prev, [movieTitle]: voteType }))

    // If voting VOY, check for matches with friends
    if (voteType === 'voy') {
      return checkForMatches(movieTitle)
    }

    return null
  }

  // Check if any friends also voted VOY on this movie
  async function checkForMatches(movieTitle) {
    const friendIds = (friends || []).map(f => f.id)
    if (friendIds.length === 0) return null

    const { data: matches } = await supabase
      .from("votos")
      .select("user_id")
      .eq("movie_title", movieTitle)
      .eq("vote", "voy")
      .in("user_id", friendIds)

    if (!matches || matches.length === 0) return null

    // Check if plans already exist for these pairs
    const matchedFriends = []
    for (const match of matches) {
      const { data: existingPlans } = await supabase
        .from("planes")
        .select("id, state")
        .eq("movie_title", movieTitle)
        .or(`and(initiator_id.eq.${user.id},partner_id.eq.${match.user_id}),and(initiator_id.eq.${match.user_id},partner_id.eq.${user.id})`)
        .not("state", "eq", "no_match")

      if (!existingPlans || existingPlans.length === 0) {
        const friend = friends.find(f => f.id === match.user_id)
        if (friend) matchedFriends.push(friend)
      }
    }

    return matchedFriends.length > 0 ? matchedFriends : null
  }

  // Get movies that friends want to see but I haven't voted on
  function getFriendSuggestions() {
    const suggestions = []
    Object.entries(friendVotes).forEach(([movieTitle, voters]) => {
      if (!myVotes[movieTitle]) {
        suggestions.push({ movieTitle, voters })
      }
    })
    return suggestions
  }

  return {
    myVotes,
    friendVotes,
    loading,
    vote,
    checkForMatches,
    getFriendSuggestions,
    refresh: fetchVotes,
  }
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase.js'

export default function useFriends(user) {
  const [friends, setFriends] = useState([])        // accepted friendships with profile data
  const [pendingIn, setPendingIn] = useState([])     // pending requests TO me
  const [pendingOut, setPendingOut] = useState([])    // pending requests FROM me
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)

  const fetchFriends = useCallback(async () => {
    if (!user) return
    // Demo mode — no Supabase, return empty (demo friend injected in CarteleraApp)
    if (user.isDemo) { setLoading(false); return }

    // Get all friendships where I'm involved
    const { data: rows } = await supabase
      .from("amistades")
      .select("*")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

    if (!rows) return

    const accepted = rows.filter(r => r.status === 'accepted')
    const pendingToMe = rows.filter(r => r.status === 'pending' && r.user_b === user.id)
    const pendingFromMe = rows.filter(r => r.status === 'pending' && r.user_a === user.id)

    // Get profile data for all friends
    const friendIds = [
      ...accepted.map(r => r.user_a === user.id ? r.user_b : r.user_a),
      ...pendingToMe.map(r => r.user_a),
      ...pendingFromMe.map(r => r.user_b),
    ]

    let profiles = {}
    if (friendIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("perfiles")
        .select("id, nombre, nombre_display, avatar_url, invite_code")
        .in("id", friendIds)
      if (profileRows) {
        profileRows.forEach(p => { profiles[p.id] = p })
      }
    }

    setFriends(accepted.map(r => {
      const friendId = r.user_a === user.id ? r.user_b : r.user_a
      return {
        friendshipId: r.id,
        id: friendId,
        ...(profiles[friendId] || { nombre: "Usuario", avatar_url: null }),
        created_at: r.created_at,
      }
    }))

    setPendingIn(pendingToMe.map(r => ({
      friendshipId: r.id,
      id: r.user_a,
      ...(profiles[r.user_a] || { nombre: "Usuario", avatar_url: null }),
      created_at: r.created_at,
    })))

    setPendingOut(pendingFromMe.map(r => ({
      friendshipId: r.id,
      id: r.user_b,
      ...(profiles[r.user_b] || { nombre: "Usuario", avatar_url: null }),
      created_at: r.created_at,
    })))

    setLoading(false)
  }, [user])

  // Initial fetch + poll every 4s
  useEffect(() => {
    fetchFriends()
    pollRef.current = setInterval(fetchFriends, 4000)
    return () => clearInterval(pollRef.current)
  }, [fetchFriends])

  // Send friend request by invite code
  async function sendRequest(inviteCode) {
    if (!user) return { error: "No user" }

    // Find user by invite code
    const { data: target } = await supabase
      .from("perfiles")
      .select("id, nombre, nombre_display, avatar_url")
      .eq("invite_code", inviteCode.toUpperCase().trim())
      .maybeSingle()

    if (!target) return { error: "Codigo no encontrado" }
    if (target.id === user.id) return { error: "No puedes agregarte a ti mismo" }

    // Check if friendship already exists (in either direction)
    const { data: existing } = await supabase
      .from("amistades")
      .select("id, status")
      .or(`and(user_a.eq.${user.id},user_b.eq.${target.id}),and(user_a.eq.${target.id},user_b.eq.${user.id})`)

    if (existing && existing.length > 0) {
      const f = existing[0]
      if (f.status === 'accepted') return { error: "Ya sois amigos" }
      return { error: "Solicitud ya enviada" }
    }

    // Create friendship request
    const { error } = await supabase.from("amistades").insert({
      user_a: user.id,
      user_b: target.id,
      status: 'pending',
    })

    if (error) return { error: error.message }
    await fetchFriends()
    return { success: true, name: target.nombre_display || target.nombre }
  }

  // Accept a pending friend request
  async function acceptRequest(friendshipId) {
    await supabase
      .from("amistades")
      .update({ status: 'accepted' })
      .eq("id", friendshipId)
    await fetchFriends()
  }

  // Reject / remove a friendship
  async function removeFriend(friendshipId) {
    await supabase
      .from("amistades")
      .delete()
      .eq("id", friendshipId)
    await fetchFriends()
  }

  // Get friends-of-friend via RPC (bypasses RLS)
  async function getFriendsOfFriend(friendId) {
    if (!user || user.isDemo) return []
    const { data, error } = await supabase
      .rpc('get_friends_of_friend', { p_friend_id: friendId })
    if (error) {
      console.error("getFriendsOfFriend error:", error)
      return []
    }
    return data || []
  }

  // Discover other users on the app (for social discovery)
  async function discoverUsers() {
    if (!user || user.isDemo) return []
    const { data, error } = await supabase
      .rpc('discover_users', { p_limit: 20 })
    if (error) {
      console.error("discoverUsers error:", error)
      return []
    }
    return data || []
  }

  // Send friend request directly by user_id (from friends-of-friends discovery)
  async function sendDirectRequest(targetId) {
    if (!user) return { error: "No user" }
    const { data, error } = await supabase
      .rpc('send_friend_request_direct', { p_target_id: targetId })
    if (error) return { error: error.message }
    if (data?.error) return { error: data.error }
    await fetchFriends()
    return { success: true, name: data.name }
  }

  return {
    friends,
    pendingIn,
    pendingOut,
    loading,
    sendRequest,
    acceptRequest,
    removeFriend,
    getFriendsOfFriend,
    sendDirectRequest,
    discoverUsers,
    refresh: fetchFriends,
  }
}

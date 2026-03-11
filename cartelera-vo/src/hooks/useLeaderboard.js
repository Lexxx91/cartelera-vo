import { useState, useEffect, useCallback } from 'react'
import { SUPABASE_URL, SUPABASE_ANON } from '../constants.js'

/**
 * useLeaderboard — Fetches top 100 from the `leaderboard` view.
 * Supports game_type filtering and campaign_id (future).
 */
export function useLeaderboard(gameType = 'breakout', campaignId = null) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      let url = `${SUPABASE_URL}/rest/v1/leaderboard?game_type=eq.${gameType}&order=score.desc&limit=100`
      if (campaignId) {
        url += `&campaign_id=eq.${campaignId}`
      }
      const res = await fetch(url, {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      })
      if (res.ok) {
        const rows = await res.json()
        setData(Array.isArray(rows) ? rows : [])
      }
    } catch (err) {
      console.warn('useLeaderboard error:', err)
    } finally {
      setLoading(false)
    }
  }, [gameType, campaignId])

  useEffect(() => { fetch_() }, [fetch_])

  return { leaderboard: data, loading, refresh: fetch_ }
}

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase.js'
import { ADMIN_EMAIL } from '../constants.js'

/**
 * Hook for managing campaign overrides from Supabase.
 * Fetches campaign_overrides table once on mount.
 * Admin can update overrides (toggle active, change dates).
 * Non-admins just get the read-only overrides list.
 */
export default function useCampaigns(user) {
  const [overrides, setOverrides] = useState([])
  const [loading, setLoading] = useState(true)

  const isAdmin = user?.email === ADMIN_EMAIL

  const fetchOverrides = useCallback(async () => {
    if (!user || user.isDemo) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('campaign_overrides')
      .select('*')
      .order('id')

    if (error) {
      // Table might not exist yet — fail silently
      console.warn('campaign_overrides fetch:', error.message)
      setLoading(false)
      return
    }

    setOverrides(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchOverrides()
  }, [fetchOverrides])

  // Admin: upsert a campaign override
  async function saveOverride(campaignId, { active, start_date, end_date }) {
    if (!isAdmin) return

    const { error } = await supabase
      .from('campaign_overrides')
      .upsert({
        id: campaignId,
        active,
        start_date,
        end_date,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (error) {
      console.error('saveOverride error:', error)
      return false
    }

    // Optimistic update
    setOverrides(prev => {
      const existing = prev.find(o => o.id === campaignId)
      if (existing) {
        return prev.map(o => o.id === campaignId ? { ...o, active, start_date, end_date } : o)
      }
      return [...prev, { id: campaignId, active, start_date, end_date }]
    })

    return true
  }

  return {
    overrides,
    loading,
    isAdmin,
    saveOverride,
    refresh: fetchOverrides,
  }
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase.js'

// WhatsApp bot number — the number where users send the link token
const WA_BOT_NUMBER = '34609962190'

/**
 * Derive VOCITO state from profile data.
 * Returns 'active' | 'inactive' | 'never_connected'
 */
export function getVocitoState(profile) {
  if (profile?.vocito_activo === true && profile?.whatsapp_jid) return 'active'
  if (profile?.vocito_activo === false) return 'inactive'
  return 'never_connected'
}

export default function useProfile(user) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [inviteeCount, setInviteeCount] = useState(0)

  useEffect(() => {
    if (!user) return

    // Demo mode — skip Supabase entirely
    if (user.isDemo) {
      setProfile({
        id: user.id,
        nombre: user.user_metadata?.full_name || 'Demo',
        nombre_display: user.user_metadata?.full_name || 'Demo',
        avatar_url: null,
        invite_code: 'GUAGUA33',
        watched: [],
        alerts: [],
      })
      setInviteeCount(2) // mock for demo
      setLoading(false)
      return
    }

    ;(async () => {
      const { data } = await supabase
        .from("perfiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      if (data) {
        setProfile(data)
        localStorage.setItem('vose_has_account', 'true')
      } else {
        // No profile yet — check if we have an invite code to create one
        const storedCode = localStorage.getItem('vose_invite_code')
        if (!storedCode) {
          // No invite code available — App.jsx gate should prevent this,
          // but as safety: don't create profile, don't sign out
          setLoading(false)
          return
        }

        // Create profile on first login
        const newProfile = {
          id: user.id,
          nombre: user.user_metadata?.full_name || user.email,
          nombre_display: user.user_metadata?.full_name || user.email?.split("@")[0] || "Cinefilo",
          avatar_url: user.user_metadata?.avatar_url || null,
          email: user.email || null,
          watched: [],
          alerts: [],
        }

        // Find who owns this invite code
        const { data: inviter } = await supabase
          .from("perfiles")
          .select("id")
          .eq("invite_code", storedCode.toUpperCase())
          .maybeSingle()
        if (inviter) {
          newProfile.invited_by = inviter.id
        }

        const { error: insertError } = await supabase.from("perfiles").insert(newProfile)

        // Auto-create friendship with inviter (accepted = instant friends)
        if (!insertError && inviter) {
          await supabase.from("amistades").insert({
            user_a: user.id,
            user_b: inviter.id,
            status: 'accepted',
          }).then(({ error: friendError }) => {
            if (friendError) console.warn('Auto-friendship failed (may already exist):', friendError.message)
          })
        }
        if (insertError) {
          console.error('Profile creation failed:', insertError)
          localStorage.removeItem('vose_has_account')
          setLoading(false)
          supabase.auth.signOut()
          return
        }

        // Clear invite code only after successful insert
        localStorage.removeItem('vose_invite_code')
        localStorage.setItem('vose_has_account', 'true')

        // Re-fetch profile to get DB-generated fields (invite_code from trigger)
        const { data: freshProfile } = await supabase
          .from("perfiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle()
        setProfile(freshProfile || newProfile)
      }
      setLoading(false)
    })()
  }, [user])

  // Fetch invitee count
  useEffect(() => {
    if (!user || user.isDemo) return
    ;(async () => {
      const { count } = await supabase
        .from("perfiles")
        .select("id", { count: 'exact', head: true })
        .eq("invited_by", user.id)
      setInviteeCount(count || 0)
    })()
  }, [user])

  // Sync email from Google (but NEVER overwrite custom avatar)
  useEffect(() => {
    if (!user || !profile || user.isDemo) return
    const updates = {}

    // Only sync Google avatar if user has NO avatar at all (first login)
    // Never overwrite a custom uploaded avatar (Supabase storage URLs)
    const googleAvatar = user.user_metadata?.avatar_url
    if (googleAvatar && !profile.avatar_url) {
      updates.avatar_url = googleAvatar
    }

    // Always sync email
    if (user.email && user.email !== profile.email) {
      updates.email = user.email
    }
    if (Object.keys(updates).length > 0) {
      setProfile(p => ({ ...p, ...updates }))
      supabase.from("perfiles").update(updates).eq("id", user.id).then(({ error }) => {
        if (error) console.error('Profile sync failed:', error)
      })
    }
  }, [user, profile?.id])

  async function updateProfile(patch) {
    setProfile(p => ({ ...p, ...patch }))
    if (!user?.isDemo) {
      const { error } = await supabase.from("perfiles").update(patch).eq("id", user.id)
      if (error) console.error('Profile update failed:', error)
    }
  }

  // Resize image to 256×256 using canvas
  function resizeImage(file) {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 256
        const ctx = canvas.getContext('2d')

        // Crop to square (center crop)
        const size = Math.min(img.width, img.height)
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2

        ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256)
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      }
      img.src = URL.createObjectURL(file)
    })
  }

  const uploadingRef = useRef(false)

  async function uploadAvatar(file) {
    if (!user || !file || uploadingRef.current) return { error: 'No user or file' }
    uploadingRef.current = true

    try {
    // Demo mode: local preview only
    if (user.isDemo) {
      const url = URL.createObjectURL(file)
      setProfile(p => ({ ...p, avatar_url: url }))
      return { url }
    }

    // Resize to 256×256
    const resized = await resizeImage(file)
    if (!resized) return { error: 'No se pudo redimensionar la imagen' }

    const filePath = `${user.id}/avatar-${Date.now()}.jpg`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, resized, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      })

    if (uploadError) {
      console.error('Avatar upload error:', uploadError)
      return { error: uploadError.message || 'Error al subir la imagen' }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    // Update profile with new avatar URL
    const { error: updateError } = await supabase.from("perfiles").update({ avatar_url: publicUrl }).eq("id", user.id)
    if (updateError) {
      console.error('Avatar profile update error:', updateError)
      return { error: updateError.message || 'Error al guardar el perfil' }
    }

    setProfile(p => ({ ...p, avatar_url: publicUrl }))
    return { url: publicUrl }
    } finally {
      uploadingRef.current = false
    }
  }

  // ═══════════════════════════════════════════════════
  // WhatsApp Linking
  // ═══════════════════════════════════════════════════

  const [waLinking, setWaLinking] = useState(false) // true while waiting for link
  const [waLinkError, setWaLinkError] = useState(null) // error message after timeout
  const waPollingRef = useRef(null)

  // Generate a short token, save it, and open wa.me with pre-filled message
  const generateWhatsAppToken = useCallback(async () => {
    if (!user || user.isDemo) return

    // Clear any previous error
    setWaLinkError(null)

    // Generate short alphanumeric token (8 chars)
    const token = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => b.toString(36).padStart(2, '0'))
      .join('')
      .slice(0, 8)

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min

    // Open WhatsApp FIRST — must be synchronous with user gesture
    // (mobile browsers block window.open/location.href after await)
    const msg = encodeURIComponent(`🎬 Ey Vocito! Conecta mi cuenta de VOSE para avisarme de pelis, matches y planes. Mi codigo: vose-${token}`)
    const waUrl = `https://wa.me/${WA_BOT_NUMBER}?text=${msg}`
    window.location.href = waUrl

    // Start polling immediately (user will come back from WhatsApp)
    setWaLinking(true)

    // Save token in Supabase (fire-and-forget, user already navigating to WA)
    supabase.from('whatsapp_link_tokens').insert({
      token,
      user_id: user.id,
      expires_at: expiresAt,
    }).then(({ error }) => {
      if (error) console.error('Token generation failed:', error)
    })
  }, [user])

  // Poll for whatsapp_jid when linking is in progress
  useEffect(() => {
    if (!waLinking || !user || user.isDemo) return

    const startTime = Date.now()

    waPollingRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('perfiles')
        .select('whatsapp_jid, vocito_activo, vocito_prefs')
        .eq('id', user.id)
        .maybeSingle()

      if (data?.whatsapp_jid) {
        setProfile(p => ({ ...p, ...data }))
        setWaLinking(false)
        setWaLinkError(null)
        clearInterval(waPollingRef.current)
        return
      }

      // Show hint after 45 seconds — bot might not be responding
      const elapsed = Date.now() - startTime
      if (elapsed > 45_000 && !waLinkError) {
        setWaLinkError('slow')
      }
    }, 3000)

    // Stop polling after 2 min and show error
    const timeout = setTimeout(() => {
      setWaLinking(false)
      setWaLinkError('timeout')
      clearInterval(waPollingRef.current)
    }, 2 * 60 * 1000)

    return () => {
      clearInterval(waPollingRef.current)
      clearTimeout(timeout)
    }
  }, [waLinking, user])

  // Unlink WhatsApp — sets vocito_activo=false but preserves prefs
  async function unlinkWhatsApp() {
    if (!user || user.isDemo) return
    const patch = { whatsapp_jid: null, whatsapp_linked_at: null, vocito_activo: false }
    setProfile(p => ({ ...p, ...patch }))
    await supabase.from('perfiles').update(patch).eq('id', user.id)
  }

  // Toggle VOCITO on/off (main switch)
  async function toggleVocito(active) {
    if (!user || user.isDemo) return
    if (active && !profile?.whatsapp_jid) {
      // Need to re-link WhatsApp first — bot will set vocito_activo=true
      generateWhatsAppToken()
      return
    }
    const patch = { vocito_activo: active }
    setProfile(p => ({ ...p, ...patch }))
    await supabase.from('perfiles').update(patch).eq('id', user.id)
  }

  // Update a single notification category preference
  async function updateVocitoPrefs(category, enabled) {
    if (!user || user.isDemo) return
    const currentPrefs = profile?.vocito_prefs || { planes: true, amigos: true, pelis_vose: true }
    const newPrefs = { ...currentPrefs, [category]: enabled }
    setProfile(p => ({ ...p, vocito_prefs: newPrefs }))
    await supabase.from('perfiles').update({ vocito_prefs: newPrefs }).eq('id', user.id)
  }

  // Retry WhatsApp linking (clears error, restarts polling)
  const retryWhatsAppLink = useCallback(() => {
    setWaLinkError(null)
    setWaLinking(true)
  }, [])

  return {
    profile, loading, updateProfile, uploadAvatar, inviteeCount,
    // WhatsApp
    generateWhatsAppToken, unlinkWhatsApp, waLinking, waLinkError, retryWhatsAppLink,
    // VOCITO preferences
    toggleVocito, updateVocitoPrefs,
  }
}

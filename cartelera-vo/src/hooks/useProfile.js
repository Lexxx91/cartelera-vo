import { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'

export default function useProfile(user) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

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
      } else {
        // Create profile on first login
        const newProfile = {
          id: user.id,
          nombre: user.user_metadata?.full_name || user.email,
          nombre_display: user.user_metadata?.full_name || user.email?.split("@")[0] || "Cinefilo",
          avatar_url: user.user_metadata?.avatar_url || null,
          watched: [],
          alerts: [],
        }

        // Check if user was invited (invite code stored at login)
        const storedCode = localStorage.getItem('vose_invite_code')
        if (storedCode) {
          // Find who owns this invite code
          const { data: inviter } = await supabase
            .from("perfiles")
            .select("id")
            .eq("invite_code", storedCode.toUpperCase())
            .maybeSingle()
          if (inviter) {
            newProfile.invited_by = inviter.id
          }
          localStorage.removeItem('vose_invite_code')
        }

        await supabase.from("perfiles").insert(newProfile)
        setProfile(newProfile)
      }
      setLoading(false)
    })()
  }, [user])

  // Update avatar from Google if changed
  useEffect(() => {
    if (!user || !profile || user.isDemo) return
    const googleAvatar = user.user_metadata?.avatar_url
    if (googleAvatar && googleAvatar !== profile.avatar_url) {
      supabase.from("perfiles").update({ avatar_url: googleAvatar }).eq("id", user.id)
      setProfile(p => ({ ...p, avatar_url: googleAvatar }))
    }
  }, [user, profile?.id])

  function updateProfile(patch) {
    setProfile(p => ({ ...p, ...patch }))
    if (!user?.isDemo) {
      supabase.from("perfiles").update(patch).eq("id", user.id)
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

  async function uploadAvatar(file) {
    if (!user || !file) return null

    // Demo mode: local preview only
    if (user.isDemo) {
      const url = URL.createObjectURL(file)
      setProfile(p => ({ ...p, avatar_url: url }))
      return url
    }

    // Resize to 256×256
    const resized = await resizeImage(file)
    if (!resized) return null

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
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    // Update profile with new avatar URL
    updateProfile({ avatar_url: publicUrl })
    return publicUrl
  }

  return { profile, loading, updateProfile, uploadAvatar }
}

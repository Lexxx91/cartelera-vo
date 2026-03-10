/**
 * Onboarding handler — WhatsApp → VOSE profile linking
 *
 * Flow:
 *   1. User taps "Conectar WhatsApp" in VOSE app
 *   2. App generates token → stores in whatsapp_link_tokens → opens wa.me/BOT?text=vose-TOKEN
 *   3. User taps Send in WhatsApp
 *   4. This handler receives the message, validates token, links JID to profile
 *   5. App polls perfiles.whatsapp_jid → detects link → shows success
 *
 * Edge cases:
 *   - Token expired/invalid → "Ese codigo ha caducado..."
 *   - Already linked → "Ya estamos conectados..."
 *   - JID used by another user → unlink previous, link new
 */

import { supabase } from '../supabase.js'
import { sendText } from '../messaging.js'

export async function handleOnboarding(sock, jid, token) {
  // 1. Check if this JID is already linked to someone
  const { data: existingProfile } = await supabase
    .from('perfiles')
    .select('id, nombre_display')
    .eq('whatsapp_jid', jid)
    .maybeSingle()

  // 2. Look up the token
  const { data: tokenRow } = await supabase
    .from('whatsapp_link_tokens')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .maybeSingle()

  // Invalid or already used token
  if (!tokenRow) {
    await sendText(sock, jid,
      'Ese código está más muerto que el grupo de WhatsApp después de organizar un plan. 🪦\n\n' +
      'Genera uno nuevo desde tu perfil en VOSE.\n' +
      '👉 cartelera-vo.vercel.app'
    )
    return
  }

  // Token expired
  if (new Date(tokenRow.expires_at) < new Date()) {
    // Mark as used so it can't be retried
    await supabase.from('whatsapp_link_tokens').update({ used: true }).eq('token', token)

    await sendText(sock, jid,
      'Chacho, 10 minutos tenías y se fueron como las entradas de un preestreno. ⏰\n\n' +
      'Genera otro código desde tu perfil en VOSE.\n' +
      '👉 cartelera-vo.vercel.app'
    )
    return
  }

  // 3. Check if the user who generated the token already has WhatsApp linked
  if (existingProfile && existingProfile.id === tokenRow.user_id) {
    // Same user re-linking — just confirm
    await supabase.from('whatsapp_link_tokens').update({ used: true }).eq('token', token)

    await sendText(sock, jid,
      `${existingProfile.nombre_display}, bro, que ya estamos conectaos! 😄\n\n` +
      'Tranqui que cuando haya match o plan te enteras por aquí antes que por el grupo. 🎬'
    )
    return
  }

  // 4. If JID is used by a DIFFERENT user → unlink previous + deactivate VOCITO
  if (existingProfile && existingProfile.id !== tokenRow.user_id) {
    await supabase.from('perfiles').update({
      whatsapp_jid: null,
      whatsapp_linked_at: null,
      vocito_activo: false,
    }).eq('id', existingProfile.id)

    console.log(`🔄 Unlinked JID ${jid} from user ${existingProfile.id} (was ${existingProfile.nombre_display})`)
  }

  // 5. Link the JID to the new user's profile + activate VOCITO
  // Check if user already has prefs (re-linking after unlinking) → preserve them
  const { data: linkingProfile } = await supabase
    .from('perfiles')
    .select('vocito_prefs')
    .eq('id', tokenRow.user_id)
    .maybeSingle()

  const updatePayload = {
    whatsapp_jid: jid,
    whatsapp_linked_at: new Date().toISOString(),
    vocito_activo: true,
  }
  // Only set default prefs if user doesn't have existing ones (first-time or wiped)
  if (!linkingProfile?.vocito_prefs) {
    updatePayload.vocito_prefs = { planes: true, amigos: true, pelis_vose: true }
  }

  const { error } = await supabase.from('perfiles').update(updatePayload).eq('id', tokenRow.user_id)

  if (error) {
    console.error('❌ Link error:', error)
    await sendText(sock, jid,
      'Fos, algo petó. Como la web del Monopol un viernes. 😅\n\n' +
      'Inténtalo otra vez desde la app, anda.'
    )
    return
  }

  // 6. Mark token as used
  await supabase.from('whatsapp_link_tokens').update({ used: true }).eq('token', token)

  // 7. Get the user's name for the welcome message
  const { data: newProfile } = await supabase
    .from('perfiles')
    .select('nombre_display')
    .eq('id', tokenRow.user_id)
    .maybeSingle()

  const name = newProfile?.nombre_display || 'cinefilo'

  console.log(`✅ Linked ${jid} → ${name} (${tokenRow.user_id})`)

  // 8. Welcome message!
  await sendText(sock, jid,
    `Ayy chacha, ${name}! 🎬\n\n` +
    'Ya estamos conectaos. Cuando tu gente y tú deslicéis la misma peli, te aviso por aquí antes de que nadie mande un audio de 4 minutos.\n\n' +
    'Ahora ve y swipea, bro. 🍿'
  )
}
